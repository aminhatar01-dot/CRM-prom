import { describe, expect, it } from "vitest";
import {
  assistantTemplates,
  getAssistantTemplate,
} from "./assistant-templates";

describe("assistant templates", () => {
  it("provides editable specialized templates", () => {
    expect(assistantTemplates.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "sales-prices",
        "quote",
        "support",
        "scheduling",
        "collections",
        "after-sales",
        "general",
      ]),
    );
  });

  it("configures the quote template with safe defaults", () => {
    expect(getAssistantTemplate("quote")?.config).toMatchObject({
      can_answer_prices: true,
      can_create_quotes: true,
      can_send_quotes: true,
      quote_requires_human_approval: true,
    });
  });
});
