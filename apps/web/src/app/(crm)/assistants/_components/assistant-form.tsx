import { assistantTones } from "@crm-pro-ai/ai/assistant";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createAssistant, updateAssistant } from "@/app/actions/ai";

type Assistant = {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  objective: string | null;
  tone: string;
  rules: string[] | string | null;
  fallback_message: string;
  active: boolean;
  channel_id: string | null;
};

export function AssistantForm({ assistant }: { assistant?: Assistant }) {
  const action = assistant ? updateAssistant : createAssistant;
  const rules = Array.isArray(assistant?.rules)
    ? assistant.rules.join("\n")
    : assistant?.rules ?? "";

  return (
    <form action={action} className="grid gap-5">
      {assistant ? <input type="hidden" name="id" value={assistant.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" name="name" defaultValue={assistant?.name} required />
        <div className="space-y-2">
          <Label htmlFor="tone">Tono</Label>
          <select
            id="tone"
            name="tone"
            defaultValue={assistant?.tone ?? "professional"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {assistantTones.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Field label="Descripcion" name="description" defaultValue={assistant?.description} />
      <Field label="Canal" name="channel_id" defaultValue={assistant?.channel_id} placeholder="whatsapp, webchat o manual" />
      <div className="space-y-2">
        <Label htmlFor="objective">Objetivo</Label>
        <textarea
          id="objective"
          name="objective"
          defaultValue={assistant?.objective ?? ""}
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prompt">Prompt</Label>
        <textarea
          id="prompt"
          name="prompt"
          defaultValue={assistant?.prompt ?? ""}
          required
          className="min-h-40 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rules">Reglas</Label>
        <textarea
          id="rules"
          name="rules"
          defaultValue={rules}
          className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fallback_message">Mensaje fallback</Label>
        <textarea
          id="fallback_message"
          name="fallback_message"
          defaultValue={assistant?.fallback_message ?? "Un asesor del equipo va a ayudarte en breve."}
          required
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={assistant?.active ?? true} />
        Asistente activo
      </label>
      <Button type="submit">{assistant ? "Guardar cambios" : "Crear asistente"}</Button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
