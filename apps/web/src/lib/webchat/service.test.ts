import { describe, expect, it } from "vitest";
import {
  appendWebchatMessage,
  loadWidgetForPublicRequest,
  startWebchatConversation,
  type SupabaseWebchatClient,
  type WebchatWidgetRow
} from "./service";

const orgOne = "00000000-0000-4000-8000-000000000001";
const orgTwo = "00000000-0000-4000-8000-000000000002";

describe("webchat service", () => {
  it("validates public token and allowed domain", async () => {
    const supabase = fakeSupabase();

    const allowed = await loadWidgetForPublicRequest(supabase, "wchat_demo", "https://example.com");
    const blocked = await loadWidgetForPublicRequest(supabase, "wchat_demo", "https://blocked.test");

    expect(allowed.ok).toBe(true);
    expect(blocked).toEqual({ ok: false, reason: "domain_not_allowed" });
  });

  it("starts a webchat conversation and stores the initial message", async () => {
    const supabase = fakeSupabase();
    const widget = widgetOne();
    const response = await startWebchatConversation({
      supabase,
      widget,
      origin: "https://example.com",
      input: {
        token: "wchat_demo",
        visitor_id: "visitor-1",
        name: "Ana Torres",
        email: "ana@example.com",
        phone: "+54911",
        page_url: "https://example.com/pricing"
      }
    });

    expect(response.conversation_id).toBeTruthy();
    expect(response.messages[0].body).toBe("Hola demo");
    expect(table(supabase, "leads")).toHaveLength(1);
    expect(table(supabase, "conversations")[0].channel).toBe("webchat");
  });

  it("saves inbound messages visible in Inbox history", async () => {
    const supabase = fakeSupabase();
    const widget = widgetOne();
    const started = await startWebchatConversation({
      supabase,
      widget,
      origin: "https://example.com",
      input: { token: "wchat_demo", visitor_id: "visitor-2", name: "Bruno", page_url: "https://example.com" }
    });

    const message = await appendWebchatMessage({
      supabase,
      widget,
      input: {
        token: "wchat_demo",
        visitor_id: "visitor-2",
        conversation_id: started.conversation_id,
        body: "Quiero hablar con ventas"
      }
    });

    expect(message.body).toBe("Quiero hablar con ventas");
    expect(table(supabase, "messages").filter((item) => item.direction === "inbound")).toHaveLength(1);
  });

  it("prevents cross tenant conversation access", async () => {
    const supabase = fakeSupabase();
    const widget = widgetOne();
    const started = await startWebchatConversation({
      supabase,
      widget,
      origin: "https://example.com",
      input: { token: "wchat_demo", visitor_id: "visitor-3", name: "Carla", page_url: "https://example.com" }
    });

    await expect(
      appendWebchatMessage({
        supabase,
        widget: widgetTwo(),
        input: {
          token: "wchat_other",
          conversation_id: started.conversation_id,
          body: "Mensaje cruzado"
        }
      }),
    ).rejects.toThrow("Conversation not found");
  });
});

function widgetOne(): WebchatWidgetRow {
  return {
    id: "00000000-0000-4000-8000-000000000801",
    organization_id: orgOne,
    name: "Demo",
    public_token: "wchat_demo",
    primary_color: "#0f766e",
    initial_message: "Hola demo",
    position: "bottom-right",
    active: true,
    allowed_domains: ["example.com"],
    assistant_id: null
  };
}

function widgetTwo(): WebchatWidgetRow {
  return {
    ...widgetOne(),
    id: "00000000-0000-4000-8000-000000000802",
    organization_id: orgTwo,
    public_token: "wchat_other"
  };
}

function fakeSupabase() {
  const db: Record<string, Array<Record<string, unknown>>> = {
    webchat_widgets: [widgetOne(), widgetTwo()],
    contacts: [],
    leads: [],
    conversations: [],
    messages: []
  };

  return {
    __db: db,
    from(name: string) {
      return new FakeQuery(db, name);
    }
  } as unknown as SupabaseWebchatClient;
}

function table(supabase: SupabaseWebchatClient, name: string) {
  return (supabase as unknown as { __db: Record<string, Array<Record<string, unknown>>> }).__db[name];
}

class FakeQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private limitCount: number | null = null;
  private action: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> | null = null;

  constructor(
    private db: Record<string, Array<Record<string, unknown>>>,
    private name: string,
  ) {}

  select() {
    this.action = this.action === "insert" || this.action === "update" ? this.action : "select";
    return this;
  }

  insert(payload: unknown) {
    this.action = "insert";
    this.payload = payload as Record<string, unknown>;
    return this;
  }

  update(payload: unknown) {
    this.action = "update";
    this.payload = payload as Record<string, unknown>;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  or(filter: string) {
    const clauses = filter.split(",").map((clause) => {
      const [column, , value] = clause.split(".");
      return { column, value };
    });
    this.filters.push((row) => clauses.some((clause) => row[clause.column] === clause.value));
    return this;
  }

  order() {
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async maybeSingle<T>() {
    const rows = await this.rows();
    return { data: (rows[0] as T) ?? null, error: null };
  }

  async single<T>() {
    const rows = await this.rows();
    return { data: (rows[0] as T) ?? null, error: null };
  }

  async returns<T>() {
    return { data: (await this.rows()) as T, error: null };
  }

  private async rows() {
    if (this.action === "insert" && this.payload) {
      const row = {
        id: this.payload.id ?? crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...this.payload
      };
      this.db[this.name].push(row);
      return [row];
    }

    const rows = this.db[this.name].filter((row) => this.filters.every((filter) => filter(row)));
    if (this.action === "update" && this.payload) {
      rows.forEach((row) => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
    }

    return this.limitCount ? rows.slice(0, this.limitCount) : rows;
  }
}
