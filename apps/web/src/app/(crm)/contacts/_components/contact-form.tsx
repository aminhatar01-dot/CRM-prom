import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createContact, updateContact } from "@/app/actions/crm";

type Member = {
  user_id: string;
  role: string;
};

type Contact = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  location: string | null;
  owner_id: string | null;
  notes: string | null;
};

export function ContactForm({ contact, members }: { contact?: Contact; members: Member[] }) {
  const action = contact ? updateContact : createContact;

  return (
    <form action={action} className="grid gap-5">
      {contact ? <input type="hidden" name="id" value={contact.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" name="first_name" defaultValue={contact?.first_name} required />
        <Field label="Apellido" name="last_name" defaultValue={contact?.last_name} />
        <Field label="Email" name="email" type="email" defaultValue={contact?.email} />
        <Field label="Telefono" name="phone" defaultValue={contact?.phone} />
        <Field label="Empresa" name="company" defaultValue={contact?.company} />
        <Field label="Ubicacion" name="location" defaultValue={contact?.location} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner_id">Responsable</Label>
        <select
          id="owner_id"
          name="owner_id"
          defaultValue={contact?.owner_id ?? ""}
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
      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={contact?.notes ?? ""}
          className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit">{contact ? "Guardar cambios" : "Crear contacto"}</Button>
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
