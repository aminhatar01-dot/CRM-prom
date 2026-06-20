import { describe, expect, it } from "vitest";
import { AIOrchestrator } from "../../../../packages/ai/src/orchestrator";
import { assistantConfigSchema } from "../../../../packages/ai/src/assistant";
import { SmartTagClassifier } from "../../../../packages/ai/src/smart-tag-classifier";
import type { SmartTagDefinition } from "../../../../packages/ai/src/smart-tags";
import { VariableExtractor } from "../../../../packages/ai/src/variable-extractor";
import type { VariableDefinition } from "../../../../packages/ai/src/variables";
import {
  prepareAutomationOperations,
  scheduleAutomationRun
} from "../../../../packages/automation/src/engine";
import type { AutomationRule } from "../../../../packages/automation/src/rules";
import {
  contactInputSchema,
  conversationInputSchema,
  leadInputSchema,
  messageInputSchema
} from "../../../../packages/database/src/crm";
import { ToolExecutor } from "../../../../packages/integrations/src/tool-executor";
import {
  appendWebchatMessage,
  startWebchatConversation,
  type SupabaseWebchatClient,
  type WebchatWidgetRow
} from "../../src/lib/webchat/service";
import {
  messageBody,
  whatsappWebhookPayloadSchema
} from "../../src/lib/whatsapp/payload";

const organizationId = "00000000-0000-4000-8000-000000000001";
const leadId = "00000000-0000-4000-8000-000000000101";
const contactId = "00000000-0000-4000-8000-000000000201";
const conversationId = "00000000-0000-4000-8000-000000000301";
const inboundMessageId = "00000000-0000-4000-8000-000000000302";

describe("FASE 12 simulated MVP journey", () => {
  it("moves a lead through Inbox, AI, tags, variables, automation, tools and WebChat", async () => {
    const inbox: Array<Record<string, unknown>> = [];
    const lead = {
      id: leadId,
      organization_id: organizationId,
      ...leadInputSchema.parse({
        first_name: "Ana",
        last_name: "Torres",
        email: "ana@example.com",
        phone: "+5491100000001",
        company: "Torres Propiedades",
        source: "manual",
        status: "nuevo",
        notes: "Solicita una demo comercial"
      })
    };
    const contact = {
      id: contactId,
      organization_id: organizationId,
      ...contactInputSchema.parse({
        first_name: "Felipe",
        last_name: "Norte",
        email: "felipe@example.com"
      })
    };
    const conversation = {
      id: conversationId,
      organization_id: organizationId,
      ...conversationInputSchema.parse({
        lead_id: lead.id,
        channel: "manual",
        status: "abierta",
        ai_status: "human"
      })
    };
    const inbound = {
      id: inboundMessageId,
      organization_id: organizationId,
      ...messageInputSchema.parse({
        conversation_id: conversation.id,
        body: "Quiero una demo de CRM y tengo un presupuesto de $2500.",
        direction: "inbound",
        channel: "manual",
        status: "delivered"
      })
    };
    inbox.push(inbound);

    expect(lead.status).toBe("nuevo");
    expect(contact.email).toBe("felipe@example.com");
    expect(conversation.lead_id).toBe(lead.id);

    const assistant = assistantConfigSchema.parse({
      organization_id: organizationId,
      name: "Asistente comercial QA",
      prompt: "Responde como asesor comercial usando solamente el contexto disponible.",
      objective: "Calificar el lead y proponer una demo",
      tone: "friendly",
      rules: "No enviar automaticamente",
      fallback_message: "Un asesor va a ayudarte.",
      active: true,
      channel_id: "manual",
      auto_reply_enabled: false
    });
    const suggestion = await new AIOrchestrator({ demoMode: true }).generateReply({
      organizationName: "Demo CRM PRO AI",
      assistant,
      conversation: {
        id: conversation.id,
        channel: conversation.channel,
        status: conversation.status,
        ai_status: conversation.ai_status
      },
      person: {
        kind: "lead",
        name: `${lead.first_name} ${lead.last_name}`,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
        notes: lead.notes
      },
      messages: [
        {
          direction: "inbound",
          body: inbound.body,
          channel: inbound.channel,
          status: inbound.status,
          created_at: "2026-06-19T12:00:00.000Z"
        }
      ]
    });

    expect(suggestion.mode).toBe("demo");
    expect(suggestion.output).toContain("Ana Torres");
    expect(assistant.auto_reply_enabled).toBe(false);

    const tag: SmartTagDefinition = {
      id: "00000000-0000-4000-8000-000000000501",
      organization_id: organizationId,
      name: "Alta intencion",
      color: "#0f766e",
      description: "Lead interesado en una demo CRM",
      classification_prompt: "Clasificar cuando solicite demo o quiera avanzar",
      active: true,
      auto_pause_assistant: false,
      notify_team: true
    };
    const [classification] = new SmartTagClassifier().classify([tag], {
      lead: {
        name: `${lead.first_name} ${lead.last_name}`,
        company: lead.company,
        status: lead.status,
        notes: lead.notes
      },
      conversation,
      messages: [{ direction: "inbound", body: inbound.body }]
    });
    expect(classification).toMatchObject({ tagId: tag.id, matched: true });

    const variable: VariableDefinition = {
      id: "00000000-0000-4000-8000-000000000601",
      organization_id: organizationId,
      name: "Presupuesto",
      key: "presupuesto",
      description: "Presupuesto declarado",
      type: "price",
      extraction_prompt: "Extraer el presupuesto mencionado por el lead",
      active: true,
      required: false,
      options: []
    };
    const [extraction] = new VariableExtractor().extract([variable], {
      lead: { id: lead.id, name: `${lead.first_name} ${lead.last_name}` },
      conversation,
      messages: [{ id: inbound.id, direction: "inbound", body: inbound.body }]
    });
    expect(extraction).toMatchObject({
      extracted: true,
      value: 2500,
      sourceMessageId: inbound.id
    });

    const automation: AutomationRule = {
      organization_id: organizationId,
      name: "Seguimiento QA",
      description: "Crea una tarea y asigna el tag",
      trigger_type: "manual",
      status: "draft",
      trigger_config: {},
      conditions: {},
      actions: [
        { type: "create_task", enabled: true, config: { title: "Coordinar demo" } },
        { type: "assign_smart_tag", enabled: true, config: { tag_id: tag.id } },
        { type: "send_message", enabled: true, config: { body: "Mensaje no enviado" } }
      ]
    };
    const run = scheduleAutomationRun(automation, {
      organization_id: organizationId,
      lead_id: lead.id,
      conversation_id: conversation.id
    });
    const operations = prepareAutomationOperations({
      rule: automation,
      actions: automation.actions,
      context: run.context,
      manual: true
    });
    expect(run.status).toBe("pending");
    expect(operations.map((operation) => operation.type)).toEqual([
      "create_task",
      "assign_smart_tag",
      "send_message"
    ]);
    expect(operations[2]).toMatchObject({ mocked: true });

    const toolResult = await new ToolExecutor().execute(
      {
        id: "00000000-0000-4000-8000-000000000911",
        organization_id: organizationId,
        integration_id: "00000000-0000-4000-8000-000000000901",
        name: "Custom Connect QA",
        type: "custom_connect",
        method: "POST",
        url: "mock://success",
        headers_schema: {},
        timeout_ms: 1000
      },
      organizationId,
      { lead_id: lead.id }
    );
    expect(toolResult).toMatchObject({ status: "success", output: { source: "mock" } });

    const webchat = fakeWebchat();
    const widget = webchatWidget();
    const started = await startWebchatConversation({
      supabase: webchat,
      widget,
      origin: "http://localhost:3000",
      input: {
        token: widget.public_token,
        visitor_id: "qa-visitor",
        name: "WebChat QA",
        email: "webchat@example.com",
        page_url: "http://localhost:3000/demo"
      }
    });
    const webchatMessage = await appendWebchatMessage({
      supabase: webchat,
      widget,
      input: {
        token: widget.public_token,
        visitor_id: "qa-visitor",
        conversation_id: started.conversation_id,
        body: "Mensaje WebChat visible en Inbox"
      }
    });
    inbox.push(webchatMessage);

    const whatsappPayload = whatsappWebhookPayloadSchema.parse({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "qa-account",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "qa-phone" },
                messages: [
                  {
                    from: "5491100000009",
                    id: "wamid.qa",
                    timestamp: "1718798400",
                    type: "text",
                    text: { body: "Mensaje WhatsApp mock" }
                  }
                ]
              }
            }
          ]
        }
      ]
    });
    const whatsappMessage = whatsappPayload.entry[0].changes[0].value.messages?.[0];
    expect(whatsappMessage).toBeDefined();
    inbox.push({
      direction: "inbound",
      channel: "whatsapp",
      body: messageBody(whatsappMessage!)
    });

    expect(inbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ body: inbound.body }),
        expect.objectContaining({ body: "Mensaje WebChat visible en Inbox" }),
        expect.objectContaining({ body: "Mensaje WhatsApp mock" })
      ])
    );
    expect(table(webchat, "leads")).toHaveLength(1);
    expect(table(webchat, "conversations")[0]).toMatchObject({ channel: "webchat" });
  });
});

function webchatWidget(): WebchatWidgetRow {
  return {
    id: "00000000-0000-4000-8000-000000000801",
    organization_id: organizationId,
    name: "WebChat QA",
    public_token: "wchat_qa_local_token",
    primary_color: "#0f766e",
    initial_message: "Hola desde QA",
    position: "bottom-right",
    active: true,
    allowed_domains: ["localhost"],
    assistant_id: null
  };
}

function fakeWebchat() {
  const db: Record<string, Array<Record<string, unknown>>> = {
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

function table(client: SupabaseWebchatClient, name: string) {
  return (client as unknown as { __db: Record<string, Array<Record<string, unknown>>> }).__db[name];
}

class FakeQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private action: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> | null = null;
  private limitCount: number | null = null;

  constructor(
    private readonly db: Record<string, Array<Record<string, unknown>>>,
    private readonly name: string
  ) {}

  select() {
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

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  or() {
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
    const rows = this.rows();
    return { data: (rows[0] as T) ?? null, error: null };
  }

  async single<T>() {
    const rows = this.rows();
    return { data: (rows[0] as T) ?? null, error: null };
  }

  async returns<T>() {
    return { data: this.rows() as T, error: null };
  }

  private rows() {
    if (this.action === "insert" && this.payload) {
      const row = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...this.payload
      };
      this.db[this.name].push(row);
      return [row];
    }

    const rows = this.db[this.name].filter((row) => this.filters.every((filter) => filter(row)));
    if (this.action === "update" && this.payload) {
      rows.forEach((row) => Object.assign(row, this.payload));
    }
    return this.limitCount ? rows.slice(0, this.limitCount) : rows;
  }
}
