import { describe, expect, it } from "vitest";
import { onboardingTemplates, recommendAssistantTemplates, recommendKnowledge } from "./onboarding-templates";

describe("client onboarding templates", () => {
  it("uses reusable use cases instead of fixed industries", () => {
    expect(onboardingTemplates.map((item) => item.key)).toEqual(expect.arrayContaining(["general", "sales", "support", "ecommerce", "professional-services", "scheduling", "quotes", "collections"]));
  });

  it("recommends assistants and knowledge from selected needs", () => {
    expect(recommendAssistantTemplates(["products", "quotes"])).toEqual(expect.arrayContaining(["sales-prices", "quote"]));
    expect(recommendKnowledge(["scheduling"])).toEqual(expect.arrayContaining(["Horarios", "Servicios reservables"]));
  });
});
