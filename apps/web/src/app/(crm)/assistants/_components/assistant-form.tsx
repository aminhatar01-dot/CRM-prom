"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AgentConfig, AgentPlaybook } from "@crm-pro-ai/ai/agent-config";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createAssistant, updateAssistant } from "@/app/actions/ai";
import { SubmitButton } from "../../_components/submit-button";

type Assistant = {
  id: string;
  name: string;
  description: string | null;
  fallback_message: string;
  active: boolean;
  channel_id: string | null;
  auto_reply_enabled: boolean;
  agent_config: AgentConfig | null;
  playbooks: AgentPlaybook[] | null;
};

const steps = ["Empresa", "Oferta", "Personalidad", "Conocimiento", "Comportamiento", "Probar"];

const defaultConfig: AgentConfig = {
  agent_name: "Asistente comercial",
  role: "asesor comercial",
  industry: "",
  business_description: "",
  sells: "",
  services: "",
  products: "",
  primary_goal: "Responder consultas y ayudar a convertir oportunidades.",
  formality: "professional",
  response_length: "normal",
  emoji_usage: "low",
  commercial_pace: "consultative",
  communication_style: "friendly",
  always_ask: [],
  never_invent: ["precios", "disponibilidad", "condiciones comerciales"],
  human_topics: ["reclamos", "pagos", "temas legales"],
  create_task_when: [],
  create_opportunity_when: [],
  create_appointment_when: [],
  pause_ai_when: [],
  auto_reply_when: ["la consulta tenga informacion suficiente"],
  draft_only_when: ["falte informacion sensible o se requiera una persona"],
  knowledge_topics: ["productos", "servicios", "preguntas frecuentes", "precios", "horarios", "politicas"]
};

const playbookDefinitions = [
  ["first_contact", "Primer contacto", "Saludar, entender el motivo de consulta y pedir solo el dato inicial necesario."],
  ["follow_up", "Seguimiento", "Retomar el contexto sin repetir todo y proponer un siguiente paso concreto."],
  ["sales", "Ventas", "Detectar necesidad, presentar una opcion real y avanzar hacia una decision sin presionar."],
  ["support", "Soporte", "Confirmar el problema, pedir datos esenciales y resolver o derivar con contexto."],
  ["collections", "Cobranza", "Tratar pagos con respeto y derivar a humano antes de confirmar importes o acuerdos."],
  ["scheduling", "Agenda", "Solicitar fecha, horario y datos necesarios antes de confirmar una cita."],
  ["reservations", "Reservas", "Validar disponibilidad real y recopilar los datos requeridos para reservar."],
  ["quote", "Presupuesto", "Reunir requisitos y generar un borrador si faltan precios o validacion humana."],
  ["after_sales", "Postventa", "Consultar satisfaccion, resolver pendientes y registrar el seguimiento necesario."]
] as const;

export function AssistantForm({ assistant }: { assistant?: Assistant }) {
  const [step, setStep] = useState(0);
  const action = assistant ? updateAssistant : createAssistant;
  const config = { ...defaultConfig, ...(assistant?.agent_config ?? {}) };
  const savedPlaybooks = new Map((assistant?.playbooks ?? []).map((playbook) => [playbook.key, playbook]));

  return (
    <form action={action} className="space-y-6">
      {assistant ? <input type="hidden" name="id" value={assistant.id} /> : null}

      <nav aria-label="Progreso de configuracion" className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`min-h-12 rounded-md border px-2 text-xs font-medium ${step === index ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "bg-background text-muted-foreground"}`}
          >
            <span className="block text-[10px]">Paso {index + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      <WizardSection active={step === 0} title="Contanos sobre tu empresa" description="Esta informacion ayuda al agente a entender a quien representa.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre del agente" name="agent_name" defaultValue={config.agent_name} required />
          <Field label="Cargo o rol" name="role" defaultValue={config.role} placeholder="Vendedor, soporte, recepcionista..." required />
          <Field label="Rubro del negocio" name="industry" defaultValue={config.industry} placeholder="Inmobiliaria, automotriz, salud..." />
          <Field label="Canal" name="channel_id" defaultValue={assistant?.channel_id ?? "whatsapp"} />
        </div>
        <TextArea label="Descripcion del negocio" name="business_description" defaultValue={config.business_description} rows={4} />
      </WizardSection>

      <WizardSection active={step === 1} title="¿Que ofrece tu empresa?" description="No hace falta escribir instrucciones tecnicas. Describe la oferta con palabras normales.">
        <TextArea label="¿Que vende?" name="sells" defaultValue={config.sells} rows={3} />
        <TextArea label="Servicios" name="services" defaultValue={config.services} rows={3} />
        <TextArea label="Productos" name="products" defaultValue={config.products} rows={4} />
        <TextArea label="Objetivo principal del agente" name="primary_goal" defaultValue={config.primary_goal} rows={3} required />
      </WizardSection>

      <WizardSection active={step === 2} title="¿Como queres que responda?" description="Elegí el estilo que mejor representa a tu equipo.">
        <ChoiceGroup label="Nivel de formalidad" name="formality" value={config.formality} options={[["very_informal", "Muy informal"], ["close", "Cercano"], ["professional", "Profesional"], ["very_formal", "Muy formal"]]} />
        <ChoiceGroup label="Longitud" name="response_length" value={config.response_length} options={[["very_short", "Muy cortas"], ["normal", "Normales"], ["detailed", "Detalladas"]]} />
        <ChoiceGroup label="Uso de emojis" name="emoji_usage" value={config.emoji_usage} options={[["never", "Nunca"], ["low", "Poco"], ["normal", "Normal"], ["frequent", "Frecuente"]]} />
        <ChoiceGroup label="Velocidad comercial" name="commercial_pace" value={config.commercial_pace} options={[["calm", "Muy tranquila"], ["consultative", "Consultiva"], ["commercial", "Comercial"], ["aggressive", "Muy activa"]]} />
        <ChoiceGroup label="Tipo de comunicacion" name="communication_style" value={config.communication_style} options={[["friendly", "Amigable"], ["technical", "Tecnica"], ["executive", "Ejecutiva"], ["premium", "Premium"], ["youthful", "Juvenil"]]} />
      </WizardSection>

      <WizardSection active={step === 3} title="Prepara la Base de Conocimiento" description="Selecciona que informacion deberia conocer. Podras cargarla en el modulo existente de Base de conocimiento.">
        <TextArea label="Informacion recomendada, una por linea" name="knowledge_topics" defaultValue={config.knowledge_topics.join("\n")} rows={8} />
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          Sugerencias: productos, servicios, preguntas frecuentes, politicas, garantias, catalogos, precios, horarios, inventario, procesos, documentos y URLs.
        </div>
      </WizardSection>

      <WizardSection active={step === 4} title="Comportamiento y playbooks" description="Estas reglas orientan al agente. No activan automatizaciones ni envios por si solas.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextArea label="Informacion que debe pedir, una por linea" name="always_ask" defaultValue={config.always_ask.join("\n")} rows={5} />
          <TextArea label="Informacion que nunca debe inventar" name="never_invent" defaultValue={config.never_invent.join("\n")} rows={5} />
          <TextArea label="Temas que requieren una persona" name="human_topics" defaultValue={config.human_topics.join("\n")} rows={5} />
          <TextArea label="Cuando crear una tarea" name="create_task_when" defaultValue={config.create_task_when.join("\n")} rows={5} />
          <TextArea label="Cuando crear una oportunidad" name="create_opportunity_when" defaultValue={config.create_opportunity_when.join("\n")} rows={5} />
          <TextArea label="Cuando crear una cita" name="create_appointment_when" defaultValue={config.create_appointment_when.join("\n")} rows={5} />
          <TextArea label="Cuando pausar la IA" name="pause_ai_when" defaultValue={config.pause_ai_when.join("\n")} rows={5} />
          <TextArea label="Cuando puede responder automaticamente" name="auto_reply_when" defaultValue={config.auto_reply_when.join("\n")} rows={5} />
          <TextArea label="Cuando generar solo borrador" name="draft_only_when" defaultValue={config.draft_only_when.join("\n")} rows={5} />
        </div>
        <div className="space-y-3 border-t pt-5">
          <h3 className="text-sm font-semibold">Playbooks editables</h3>
          {playbookDefinitions.map(([key, name, instructions]) => {
            const saved = savedPlaybooks.get(key);
            return (
              <div key={key} className="grid gap-3 rounded-md border p-3 md:grid-cols-[180px_1fr]">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name={`playbook_${key}_enabled`} defaultChecked={saved?.enabled ?? ["first_contact", "follow_up", "sales"].includes(key)} />
                  {name}
                </label>
                <textarea name={`playbook_${key}`} defaultValue={saved?.instructions ?? instructions} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
            );
          })}
        </div>
      </WizardSection>

      <WizardSection active={step === 5} title="Revisa y guarda" description="El sistema generara internamente el contexto, las reglas y el estilo. El prompt tecnico no se muestra ni necesita editarse.">
        <div className="grid gap-3 md:grid-cols-3">
          <Summary label="Agente" value={config.agent_name} />
          <Summary label="Rol" value={config.role} />
          <Summary label="Rubro" value={config.industry || "General"} />
        </div>
        <TextArea label="Mensaje cuando necesita ayuda humana" name="fallback_message" defaultValue={assistant?.fallback_message ?? "Gracias por escribir. Un asesor del equipo va a ayudarte en breve."} rows={3} required />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input name="active" type="checkbox" defaultChecked={assistant?.active ?? true} />
            Asistente activo
          </label>
          <label className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <span className="flex items-center gap-2 font-medium">
              <input name="auto_reply_enabled" type="checkbox" defaultChecked={assistant?.auto_reply_enabled ?? false} />
              Permitir respuestas automaticas
            </span>
            <span className="mt-1 block text-xs text-amber-800">Requiere automatizacion activa y conversacion en modo IA automatica.</span>
          </label>
        </div>
        <p className="text-sm text-muted-foreground">Despues de guardar podras probar una conversacion desde el detalle del asistente.</p>
        <SubmitButton>{assistant ? "Guardar configuracion" : "Crear y probar asistente"}</SubmitButton>
      </WizardSection>

      <div className="flex items-center justify-between border-t pt-4">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
          <ChevronLeft className="mr-2 size-4" />Anterior
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>
            Siguiente<ChevronRight className="ml-2 size-4" />
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function WizardSection({ active, title, description, children }: { active: boolean; title: string; description: string; children: React.ReactNode }) {
  return <section className={active ? "space-y-5" : "hidden"}><div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>{children}</section>;
}

function Field({ label, name, defaultValue, placeholder, required = false }: { label: string; name: string; defaultValue?: string | null; placeholder?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} /></div>;
}

function TextArea({ label, name, defaultValue, rows, required = false }: { label: string; name: string; defaultValue?: string | null; rows: number; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><textarea id={name} name={name} defaultValue={defaultValue ?? ""} rows={rows} required={required} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>;
}

function ChoiceGroup({ label, name, value, options }: { label: string; name: string; value: string; options: ReadonlyArray<readonly [string, string]> }) {
  return <fieldset className="space-y-2"><legend className="text-sm font-medium">{label}</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{options.map(([optionValue, optionLabel]) => <label key={optionValue} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm"><input type="radio" name={name} value={optionValue} defaultChecked={value === optionValue} />{optionLabel}</label>)}</div></fieldset>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
