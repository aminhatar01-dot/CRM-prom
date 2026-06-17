import { httpMethods } from "@crm-pro-ai/integrations/tools";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createCustomConnect, updateCustomConnect } from "@/app/actions/integrations";

type CustomConnectTool = {
  id: string;
  integration_id: string;
  name: string;
  description: string | null;
  method: string | null;
  url: string | null;
  headers_schema: Record<string, unknown>;
  body_schema: Record<string, unknown>;
  response_schema: Record<string, unknown>;
  active: boolean;
  timeout_ms: number;
};

export function CustomConnectForm({ tool }: { tool?: CustomConnectTool }) {
  const action = tool ? updateCustomConnect : createCustomConnect;

  return (
    <form action={action} className="grid gap-5">
      {tool ? (
        <>
          <input type="hidden" name="id" value={tool.id} />
          <input type="hidden" name="integration_id" value={tool.integration_id} />
        </>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={tool?.name ?? ""} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripcion</Label>
        <textarea id="description" name="description" defaultValue={tool?.description ?? ""} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="grid gap-4 md:grid-cols-[140px_1fr_140px]">
        <div className="space-y-2">
          <Label htmlFor="method">Metodo</Label>
          <select id="method" name="method" defaultValue={tool?.method ?? "GET"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {httpMethods.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input id="url" name="url" defaultValue={tool?.url ?? "mock://success"} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeout_ms">Timeout ms</Label>
          <Input id="timeout_ms" name="timeout_ms" type="number" min="1000" max="30000" defaultValue={tool?.timeout_ms ?? 8000} />
        </div>
      </div>
      <JsonTextarea name="headers_schema" label="Headers schema JSON" value={tool?.headers_schema ?? {}} />
      <JsonTextarea name="body_schema" label="Body schema JSON" value={tool?.body_schema ?? { query: "string" }} />
      <JsonTextarea name="response_schema" label="Response schema JSON" value={tool?.response_schema ?? { ok: "boolean" }} />
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={tool?.active ?? false} />
        Activa
      </label>
      <Button type="submit">{tool ? "Guardar cambios" : "Crear Custom Connect"}</Button>
    </form>
  );
}

function JsonTextarea({ name, label, value }: { name: string; label: string; value: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        defaultValue={JSON.stringify(value, null, 2)}
        className="min-h-28 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
      />
    </div>
  );
}
