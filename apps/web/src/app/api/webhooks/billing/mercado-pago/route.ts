import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isMercadoPagoConfigured,
  verifyMercadoPagoSignature,
  parseMercadoPagoEvent,
} from "@/lib/billing/providers";
import { recordWebhookEvent } from "@/lib/billing/core";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ status: "not_configured" }, { status: 200 });
  }

  const rawBody = await req.text();
  const signature  = req.headers.get("x-signature");
  const requestId  = req.headers.get("x-request-id");
  const secret     = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;

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

  const event = parseMercadoPagoEvent(body);
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

  // Future: process payment events, activate subscriptions, grant credits
  // For now: store raw event and return 200 (idempotent)

  return NextResponse.json({ status: "ok", event_id: result.event_id }, { status: 200 });
}
