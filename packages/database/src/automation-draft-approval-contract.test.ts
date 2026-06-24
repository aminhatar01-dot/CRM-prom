import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const automationActions = readFileSync(
  resolve(root, "apps/web/src/app/actions/automations.ts"),
  "utf8",
);
const realEngine = readFileSync(
  resolve(root, "apps/web/src/lib/automation/real-engine.ts"),
  "utf8",
);
const inboxPage = readFileSync(
  resolve(root, "apps/web/src/app/(crm)/inbox/page.tsx"),
  "utf8",
);
const actionNotice = readFileSync(
  resolve(root, "apps/web/src/app/(crm)/_components/action-notice.tsx"),
  "utf8",
);

describe("automation draft approval contract", () => {
  it("sends approved drafts as a real user message compatible with the messages enum", () => {
    expect(realEngine).toContain('sender_type: approvedBy ? "user" : "assistant"');
    expect(realEngine).toContain("sender_user_id: approvedBy");
    expect(realEngine).not.toContain('sender_type: "agent"');
  });

  it("reserves pending drafts before sending to avoid double approval", () => {
    expect(automationActions).toContain('status: "approved"');
    expect(automationActions).toContain('.eq("status", "pending")');
    expect(automationActions).toContain("draftSendErrorCode");
  });

  it("stores and surfaces safe draft send errors in Inbox", () => {
    expect(realEngine).toContain("markDraftFailed");
    expect(realEngine).toContain('event_type: "send_failed"');
    expect(realEngine).toContain("safeWhatsAppError");
    expect(inboxPage).toContain("error_message");
    expect(actionNotice).toContain("draft-whatsapp-api");
    expect(actionNotice).toContain("draft-send-failed");
  });
});
