import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isStripeConfigured,
  verifyStripeSignature,
  parseStripeEvent,
} from "@/lib/billing/providers";
import { recordWebhookEvent } from "@/lib/billing/core";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isStripeConfigured()) {
    return NextResponse.json({ status: "not_configured" }, { status: 200 });
  }

  const rawBody     = await req.text();
  const sigHeader   = req.headers.get("stripe-signature");
  const secret      = process.env.STRIPE_WEBHOOK_SECRET!;

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

  const event = parseStripeEvent(body);
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

  // Future: handle invoice.paid, customer.subscription.updated, etc.
  // All events stored idempotently for replay.

  return NextResponse.json({ status: "ok", event_id: result.event_id }, { status: 200 });
}
