import { describe, expect, it } from "vitest";
import type { AIMessageContext } from "./assistant";
import { classifyConversationIntent } from "./conversation-intent";

const message = (direction: "inbound" | "outbound", body: string): AIMessageContext => ({
  direction,
  body,
  channel: "whatsapp",
  status: "delivered",
  created_at: "2026-06-27T12:00:00Z"
});

describe("conversation intent", () => {
  it("detects a simple greeting without treating prior inventory as the current request", () => {
    const intent = classifyConversationIntent([
      message("inbound", "Busco departamento en Roldan"),
      message("outbound", "Tengo uno de un dormitorio. ¿Buscas alquilar o comprar?"),
      message("inbound", "Hola")
    ]);

    expect(intent).toMatchObject({ type: "simple_greeting", hasPriorConversation: true, requiresKnowledge: false });
  });

  it("treats a short reply as continuity when it answers the previous question", () => {
    const intent = classifyConversationIntent([
      message("outbound", "¿Buscas alquilar o comprar?"),
      message("inbound", "Alquilar")
    ]);

    expect(intent.type).toBe("short_answer");
    expect(intent.previousOutbound).toContain("alquilar");
  });

  it("detects an inventory request that requires knowledge", () => {
    expect(classifyConversationIntent([message("inbound", "¿Qué propiedades tienen?")]))
      .toMatchObject({ type: "inventory_query", requiresKnowledge: true });
  });
});
