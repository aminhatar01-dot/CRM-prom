import { z } from "zod";

export const quoteStatuses = [
  "draft", "pending_approval", "sent", "accepted", "rejected", "expired", "cancelled"
] as const;

const optionalUuid = z.string().uuid().nullable().optional();
const money = z.coerce.number().finite().min(0).max(999_999_999_999);

export const quoteItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  sku: z.string().trim().max(120).nullable().optional(),
  product_code: z.string().trim().max(120).nullable().optional(),
  quantity: z.coerce.number().finite().positive().max(999_999),
  unit_price: money,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  discount_amount: money.default(0),
  stock: z.string().trim().max(120).nullable().optional(),
  availability: z.string().trim().max(200).nullable().optional(),
  source_document_id: optionalUuid,
  source_title: z.string().trim().max(200).nullable().optional()
});

export const quoteSchema = z.object({
  lead_id: optionalUuid,
  contact_id: optionalUuid,
  conversation_id: optionalUuid,
  customer_name: z.string().trim().min(2).max(160),
  customer_phone: z.string().trim().max(40).nullable().optional(),
  status: z.enum(quoteStatuses).default("draft"),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  tax_total: money.default(0),
  expires_at: z.string().datetime().nullable().optional(),
  internal_notes: z.string().trim().max(4_000).nullable().optional(),
  commercial_terms: z.string().trim().max(4_000).nullable().optional(),
  items: z.array(quoteItemSchema).min(1).max(100)
});

export const quoteIdSchema = z.object({ id: z.string().uuid() });
export const publicQuoteTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export function calculateQuoteTotals(items: Array<Pick<z.infer<typeof quoteItemSchema>, "quantity" | "unit_price" | "discount_amount">>, taxTotal = 0) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
  const discountTotal = roundMoney(items.reduce((sum, item) => sum + item.discount_amount, 0));
  return { subtotal, discountTotal, taxTotal: roundMoney(taxTotal), total: roundMoney(Math.max(0, subtotal - discountTotal + taxTotal)) };
}

function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

export type QuoteInput = z.infer<typeof quoteSchema>;
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;
export type QuoteStatus = (typeof quoteStatuses)[number];
