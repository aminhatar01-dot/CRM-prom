import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createEmbeddedSignupState,
  decryptWhatsAppToken,
  encryptWhatsAppToken,
  verifyEmbeddedSignupState
} from "./credentials";

describe("WhatsApp embedded signup credentials", () => {
  const key = crypto.randomBytes(32).toString("base64");

  it("encrypts tenant access tokens with authenticated encryption", () => {
    const encrypted = encryptWhatsAppToken("secret-business-token", key);

    expect(encrypted).not.toContain("secret-business-token");
    expect(decryptWhatsAppToken(encrypted, key)).toBe("secret-business-token");
  });

  it("signs short-lived state for the current organization and user", () => {
    const state = createEmbeddedSignupState({
      organizationId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      appSecret: "app-secret",
      now: 1_000
    });

    expect(
      verifyEmbeddedSignupState({
        state,
        organizationId: "00000000-0000-4000-8000-000000000001",
        userId: "00000000-0000-4000-8000-000000000002",
        appSecret: "app-secret",
        now: 2_000
      }),
    ).toBe(true);
    expect(
      verifyEmbeddedSignupState({
        state,
        organizationId: "00000000-0000-4000-8000-000000000099",
        userId: "00000000-0000-4000-8000-000000000002",
        appSecret: "app-secret",
        now: 2_000
      }),
    ).toBe(false);
  });
});
