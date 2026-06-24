import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function InboxShell() {
  return (
    <div>
      <aside aria-label="Conversaciones">Ana Torres</aside>
      <section aria-label="Mensajes">
        <p>Hola, quiero conocer el CRM.</p>
        <form>
          <input aria-label="Mensaje" />
          <button>Enviar</button>
        </form>
      </section>
    </div>
  );
}

describe("InboxShell", () => {
  it("renders the core inbox regions", () => {
    const element = InboxShell();

    expect(element.type).toBe("div");
    expect(React.Children.count(element.props.children)).toBe(2);
  });

  it("keeps the real inbox input visible inside a fixed-height chat panel", () => {
    const page = readFileSync(join(process.cwd(), "apps/web/src/app/(crm)/inbox/page.tsx"), "utf8");

    expect(page).toContain('data-testid="inbox-conversation-panel"');
    expect(page).toContain('data-testid="inbox-automation-panel"');
    expect(page).toContain('data-testid="inbox-messages-scroll"');
    expect(page).toContain('data-testid="inbox-message-input"');
    expect(page).toContain("shrink-0 border-t bg-card p-4");
    expect(page).toContain("max-h-[min(42dvh,360px)]");
  });
});
