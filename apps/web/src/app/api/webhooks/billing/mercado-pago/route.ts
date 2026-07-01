import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isMercadoPagoConfigured,
  verifyMercadoPagoSignature,
  parseMercadoPagoEvent,
} from "@/lib/billing/providers";
import { recordWebhookEvent } from "@/lib/billing/core";
import { completeCheckoutSession } from "@/lib/billing/checkout";

const MP_SYSTEM_USER = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ status: "not_configured" }, { status: 200 });
  }

  const rawBody   = await req.text();
  const signature = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  const secret    = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;

  const valid = await verifyMercadoPagoSignature(rawBody, signature, requestId, secret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event        = parseMercadoPagoEvent(body);
  const adminSupabase = createAdminClient();

  const result = await recordWebhookEvent(
    adminSupabase,
    "mercado_pago",
    event.externalId,
    event.eventType,
    body,
  );

  if (result.duplicate) {
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  // Process payment approved event
  try {
    if (event.eventType === "payment" || event.eventType === "payment.updated") {
      const dataId = String((body.data as Record<string, unknown> | undefined)?.id ?? "");

      if (dataId && process.env.MERCADO_PAGO_ACCESS_TOKEN) {
        // Fetch payment details to get external_reference (our session_id)
        const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` },
        });

        if (paymentRes.ok) {
          const payment = await paymentRes.json() as Record<string, unknown>;
          const status  = String(payment.status ?? "");
          const sessionId = String(payment.external_reference ?? "");

          if (status === "approved" && sessionId) {
            const idempotencyKey = `mp-payment-${dataId}`;
            await completeCheckoutSession(adminSupabase, sessionId, MP_SYSTEM_USER, idempotencyKey);

            await adminSupabase
              .from("billing_webhook_events")
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq("id", result.event_id);
          }
        }
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
