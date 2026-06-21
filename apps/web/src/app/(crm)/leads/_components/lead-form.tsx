import { leadStatuses } from "@crm-pro-ai/database/crm";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createLead, updateLead } from "@/app/actions/crm";
import { SubmitButton } from "../../_components/submit-button";

type Member = {
  user_id: string;
  role: string;
};

type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string;
  owner_id: string | null;
  notes: string | null;
};

export function LeadForm({ lead, members }: { lead?: Lead; members: Member[] }) {
  const action = lead ? updateLead : createLead;

  return (
    <form action={action} className="grid gap-5">
      {lead ? <input type="hidden" name="id" value={lead.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" name="first_name" defaultValue={lead?.first_name} required />
        <Field label="Apellido" name="last_name" defaultValue={lead?.last_name} />
        <Field label="Email" name="email" type="email" defaultValue={lead?.email} />
        <Field label="Telefono" name="phone" defaultValue={lead?.phone} />
        <Field label="Empresa" name="company" defaultValue={lead?.company} />
        <Field label="Origen" name="source" defaultValue={lead?.source} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={lead?.status ?? "nuevo"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {leadStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner_id">Responsable</Label>
          <select
            id="owner_id"
            name="owner_id"
            defaultValue={lead?.owner_id ?? ""}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Sin asignar</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.role} - {member.user_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Observaciones</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={lead?.notes ?? ""}
          className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <SubmitButton>{lead ? "Guardar cambios" : "Crear lead"}</SubmitButton>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}
