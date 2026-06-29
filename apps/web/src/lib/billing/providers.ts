/**
 * Billing providers abstraction.
 * - "manual": always available, no external credentials required.
 * - "mercado_pago": requires MERCADO_PAGO_ACCESS_TOKEN + MERCADO_PAGO_WEBHOOK_SECRET.
 * - "stripe": requires STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.
 *
 * Build never fails if provider env vars are missing — providers are detected at runtime.
 */

import type { BillingProvider } from "./types";

export function getActiveProvider(): BillingProvider {
  const env = process.env.BILLING_PROVIDER as BillingProvider | undefined;
  if (env === "stripe" && process.env.STRIPE_SECRET_KEY) return "stripe";
  if (env === "mercado_pago" && process.env.MERCADO_PAGO_ACCESS_TOKEN) return "mercado_pago";
  return "manual";
}

export function isMercadoPagoConfigured(): boolean {
  return !!(process.env.MERCADO_PAGO_ACCESS_TOKEN && process.env.MERCADO_PAGO_WEBHOOK_SECRET);
}

export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

// ─── Webhook signature verification ──────────────────────────────────────────

export async function verifyMercadoPagoSignature(
  rawBody: string,
  signature: string | null,
  xRequestId: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  try {
    const manifest = `id:${xRequestId};request-id:${xRequestId};ts:${Date.now()};`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
    const expectedHex = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // MP signature format: ts=...v1=<hex>
    return signature.includes(expectedHex);
  } catch {
    return false;
  }
}

export async function verifyStripeSignature(
  rawBody: string,
  stripeSignatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!stripeSignatureHeader) return false;
  try {
    const parts = Object.fromEntries(
      stripeSignatureHeader.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k, v];
      }),
    );
    const timestamp = parts["t"];
    const v1        = parts["v1"];
    if (!timestamp || !v1) return false;

    const payload = `${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedHex = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expectedHex === v1;
  } catch {
    return false;
  }
}

// ─── Provider-specific event parsing ─────────────────────────────────────────

export type NormalizedBillingEvent = {
  externalId: string | null;
  eventType: string;
  orgIdentifier: string | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
};

export function parseMercadoPagoEvent(
  body: Record<string, unknown>,
): NormalizedBillingEvent {
  return {
    externalId:    String(body.id ?? ""),
    eventType:     String(body.type ?? body.action ?? "unknown"),
    orgIdentifier: String((body.data as Record<string, unknown>)?.external_reference ?? ""),
    amountCents:   null,
    currency:      null,
    status:        String((body.data as Record<string, unknown>)?.status ?? ""),
    metadata:      body as Record<string, unknown>,
  };
}

export function parseStripeEvent(
  body: Record<string, unknown>,
): NormalizedBillingEvent {
  const data = (body.data as { object?: Record<string, unknown> })?.object ?? {};
  return {
    externalId:    String(body.id ?? ""),
    eventType:     String(body.type ?? "unknown"),
    orgIdentifier: String((data.metadata as Record<string, unknown> | undefined)?.organization_id ?? data.customer ?? ""),
    amountCents:   typeof data.amount_paid === "number" ? data.amount_paid : null,
    currency:      typeof data.currency === "string" ? data.currency.toUpperCase() : null,
    status:        String(data.status ?? ""),
    metadata:      body as Record<string, unknown>,
  };
}
