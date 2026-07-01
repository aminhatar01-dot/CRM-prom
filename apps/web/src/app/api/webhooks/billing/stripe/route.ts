import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isStripeConfigured,
  verifyStripeSignature,
  parseStripeEvent,
} from "@/lib/billing/providers";
import { recordWebhookEvent } from "@/lib/billing/core";
import { completeCheckoutSession } from "@/lib/billing/checkout";

const STRIPE_SYSTEM_USER = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isStripeConfigured()) {
    return NextResponse.json({ status: "not_configured" }, { status: 200 });
  }

  const rawBody   = await req.text();
  const sigHeader = req.headers.get("stripe-signature");
  const secret    = process.env.STRIPE_WEBHOOK_SECRET!;

  const valid = await verifyStripeSignature(rawBody, sigHeader, secret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event        = parseStripeEvent(body);
  const adminSupabase = createAdminClient();

  const result = await recordWebhookEvent(
    adminSupabase,
    "stripe",
    event.externalId,
    event.eventType,
    body,
  );

  if (result.duplicate) {
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  // Process payment events
  try {
    if (event.eventType === "checkout.session.completed") {
      const sessionObj = (body.data as { object?: Record<string, unknown> })?.object ?? {};
      const sessionId  = String((sessionObj.metadata as Record<string, unknown> | undefined)?.session_id ?? "");

      if (sessionId) {
        const idempotencyKey = `stripe-checkout-${event.externalId}`;
        await completeCheckoutSession(adminSupabase, sessionId, STRIPE_SYSTEM_USER, idempotencyKey);

        // Mark webhook event processed
        await adminSupabase
          .from("billing_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", result.event_id);
      }
    }

    if (event.eventType === "invoice.paid") {
      const invoiceObj   = (body.data as { object?: Record<string, unknown> })?.object ?? {};
      const externalRef  = String((invoiceObj.metadata as Record<string, unknown> | undefined)?.session_id ?? "");
      if (externalRef) {
        const idempotencyKey = `stripe-invoice-${event.externalId}`;
        await completeCheckoutSession(adminSupabase, externalRef, STRIPE_SYSTEM_USER, idempotencyKey);

        await adminSupabase
          .from("billing_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", result.event_id);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await adminSupabase
      .from("billing_webhook_events")
      .update({ error_message: errorMessage })
      .eq("id", result.event_id);
  }

  return NextResponse.json({ status: "ok", event_id: result.event_id }, { status: 200 });
}
