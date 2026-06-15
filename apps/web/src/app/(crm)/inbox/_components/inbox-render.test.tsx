import React from "react";
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
});
