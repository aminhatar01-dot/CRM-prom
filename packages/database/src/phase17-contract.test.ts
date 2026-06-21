import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260621150000_phase_17_whatsapp_embedded_signup.sql"),
  "utf8",
);

describe("FASE 17 WhatsApp Embedded Signup contract", () => {
  it("stores credentials in a private tenant-scoped table", () => {
    expect(migration).toContain("create table public.whatsapp_channel_credentials");
    expect(migration).toContain("organization_id uuid not null");
    expect(migration).toContain("revoke all on public.whatsapp_channel_credentials from anon, authenticated");
  });

  it("enforces channel and credential organization integrity", () => {
    expect(migration).toContain("validate_whatsapp_channel_credentials_tenant");
    expect(migration).toContain("channel_setting_id must belong to the same organization");
  });

  it("tracks embedded connection and token lifecycle without storing plaintext tokens", () => {
    expect(migration).toContain("connection_method");
    expect(migration).toContain("token_status");
    expect(migration).toContain("access_token_ciphertext");
    expect(migration).not.toContain("access_token text");
  });
});
