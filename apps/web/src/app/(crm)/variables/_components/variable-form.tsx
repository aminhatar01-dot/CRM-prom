import { variableTypes } from "@crm-pro-ai/ai/variables";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createVariable, updateVariable } from "@/app/actions/variables";
import { SubmitButton } from "../../_components/submit-button";

type Variable = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  type: string;
  extraction_prompt: string;
  active: boolean;
  required: boolean;
  options: string[] | null;
};

export function VariableForm({ variable }: { variable?: Variable }) {
  const action = variable ? updateVariable : createVariable;

  return (
    <form action={action} className="grid gap-5">
      {variable ? <input type="hidden" name="id" value={variable.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" name="name" defaultValue={variable?.name} required />
        <Field label="Key" name="key" defaultValue={variable?.key} placeholder="presupuesto" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          defaultValue={variable?.type ?? "text"}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {variableTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <Field label="Descripcion" name="description" defaultValue={variable?.description} />
      <div className="space-y-2">
        <Label htmlFor="extraction_prompt">Prompt de extraccion</Label>
        <textarea
          id="extraction_prompt"
          name="extraction_prompt"
          defaultValue={variable?.extraction_prompt ?? ""}
          required
          className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="options">Opciones</Label>
        <textarea
          id="options"
          name="options"
          defaultValue={(variable?.options ?? []).join("\n")}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input name="active" type="checkbox" defaultChecked={variable?.active ?? true} />
          Activa
        </label>
        <label className="flex items-center gap-2">
          <input name="required" type="checkbox" defaultChecked={variable?.required ?? false} />
          Requerida
        </label>
      </div>
      <SubmitButton>{variable ? "Guardar cambios" : "Crear variable"}</SubmitButton>
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
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} />
    </div>
  );
}
