import { automationActionTypes, automationRuleStatuses, automationTriggerTypes } from "@crm-pro-ai/automation/rules";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createAutomationRule, updateAutomationRule } from "@/app/actions/automations";

type AutomationFormRule = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  automation_actions: Array<{
    action_type: string;
    config: Record<string, unknown>;
    enabled: boolean;
  }> | null;
};

const defaultActions = [
  {
    type: "create_task",
    enabled: true,
    config: {
      title: "Seguimiento comercial",
      description: "Revisar oportunidad y responder manualmente."
    }
  }
];

export function AutomationForm({ rule }: { rule?: AutomationFormRule }) {
  const action = rule ? updateAutomationRule : createAutomationRule;
  const actions = rule?.automation_actions?.map((item) => ({
    type: item.action_type,
    enabled: item.enabled,
    config: item.config
  })) ?? defaultActions;

  return (
    <form action={action} className="grid gap-5">
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={rule?.name ?? ""} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripcion</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={rule?.description ?? ""}
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="trigger_type">Trigger</Label>
          <select
            id="trigger_type"
            name="trigger_type"
            defaultValue={rule?.trigger_type ?? "manual"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {automationTriggerTypes.map((trigger) => (
              <option key={trigger} value={trigger}>
                {trigger}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={rule?.status ?? "draft"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {automationRuleStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="conditions">Condiciones JSON</Label>
        <textarea
          id="conditions"
          name="conditions"
          defaultValue={JSON.stringify(rule?.conditions ?? {}, null, 2)}
          className="min-h-28 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="trigger_config">Configuracion del trigger JSON</Label>
        <textarea
          id="trigger_config"
          name="trigger_config"
          defaultValue={JSON.stringify(rule?.trigger_config ?? {}, null, 2)}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="actions_json">Acciones JSON</Label>
        <textarea
          id="actions_json"
          name="actions_json"
          defaultValue={JSON.stringify(actions, null, 2)}
          className="min-h-48 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
          required
        />
        <p className="text-xs text-muted-foreground">Tipos disponibles: {automationActionTypes.join(", ")}.</p>
      </div>
      <Button type="submit">{rule ? "Guardar cambios" : "Crear automatizacion"}</Button>
    </form>
  );
}
