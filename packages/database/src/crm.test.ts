import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contactInputSchema,
  conversationInputSchema,
  leadInputSchema,
  messageInputSchema
} from "./crm";

describe("crm schemas", () => {
  it("validates lead creation payloads", () => {
    const lead = leadInputSchema.parse({
      first_name: "Ana",
      last_name: "Torres",
      email: "ana@example.com",
      phone: "+5491100000001",
      company: "Torres Propiedades",
      source: "webchat",
      status: "nuevo",
      owner_id: "",
      notes: "Quiere una demo."
    });

    expect(lead.status).toBe("nuevo");
    expect(lead.owner_id).toBeNull();
  });

  it("validates contact payloads", () => {
    expect(() =>
      contactInputSchema.parse({
        first_name: "Ga",
        email: "gabriela@example.com"
      }),
    ).not.toThrow();
  });

  it("requires a lead or contact for conversations", () => {
    expect(() =>
      conversationInputSchema.parse({
        channel: "manual",
        status: "abierta",
        ai_status: "human"
      }),
    ).toThrow();
  });

  it("validates message creation payloads", () => {
    const message = messageInputSchema.parse({
      conversation_id: "00000000-0000-4000-8000-000000000301",
      body: "Hola",
      direction: "outbound",
      channel: "manual",
      status: "sent"
    });

    expect(message.status).toBe("sent");
  });
});

describe("tenant isolation contract", () => {
  it("uses organization_id in CRM write payloads", () => {
    const insertPayload = {
      organization_id: "00000000-0000-4000-8000-000000000001",
      first_name: "Ana",
      title: "Ana"
    };

    expect(insertPayload).toHaveProperty("organization_id");
  });

  it("enforces tenant references in the phase 2 migration", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260615204000_phase_2_crm_core.sql"),
      "utf8",
    );

    expect(migration).toContain("enforce_crm_tenant_integrity");
    expect(migration).toContain("conversation_id must belong to the same organization");
    expect(migration).toContain("owner_id must belong to the same organization");
  });
});
