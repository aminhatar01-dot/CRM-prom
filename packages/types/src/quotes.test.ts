import { describe, expect, it } from "vitest";
import { calculateQuoteTotals, publicQuoteTokenSchema, quoteSchema } from "./quotes";

describe("quote contracts", () => {
  it("validates a manual quote and calculates totals", () => {
    const quote = quoteSchema.parse({ customer_name: "Cliente Demo", currency: "ARS", tax_total: 210, items: [
      { name: "Producto A", quantity: 2, unit_price: 1000, currency: "ARS", discount_amount: 100 },
      { name: "Servicio B", quantity: 1, unit_price: 500, currency: "ARS", discount_amount: 0 }
    ] });
    expect(calculateQuoteTotals(quote.items, quote.tax_total)).toEqual({ subtotal: 2500, discountTotal: 100, taxTotal: 210, total: 2610 });
  });

  it("rejects invalid amounts and weak public tokens", () => {
    expect(() => quoteSchema.parse({ customer_name: "A", currency: "ARS", items: [] })).toThrow();
    expect(publicQuoteTokenSchema.safeParse("predictable-token").success).toBe(false);
    expect(publicQuoteTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
  });
});
