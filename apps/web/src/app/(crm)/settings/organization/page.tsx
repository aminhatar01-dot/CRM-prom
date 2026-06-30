import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageSettings } from "@/lib/permissions/roles";
import { updateOrganization } from "@/app/actions/organization";

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageSettings(org.role)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: orgData } = await admin
    .from("organizations")
    .select("id, name, description, business_type, country, currency, timezone, tax_id, fiscal_name, logo_url")
    .eq("id", org.id)
    .maybeSingle();

  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.success === "1";

  async function handleSubmit(formData: FormData) {
    "use server";
    try {
      await updateOrganization({
        name:          formData.get("name") as string,
        description:   formData.get("description") as string,
        business_type: formData.get("business_type") as string,
        country:       formData.get("country") as string,
        currency:      formData.get("currency") as string,
        timezone:      formData.get("timezone") as string,
        tax_id:        formData.get("tax_id") as string,
        fiscal_name:   formData.get("fiscal_name") as string,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      redirect(`/settings/organization?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/organization?success=1");
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil de la organización</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Información de tu empresa visible en documentos y reportes.
        </p>
      </div>

      {saved && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Cambios guardados correctamente.
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </p>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Nombre de la empresa *</label>
            <input
              name="name"
              required
              defaultValue={orgData?.name ?? ""}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={orgData?.description ?? ""}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo de negocio</label>
            <input
              name="business_type"
              defaultValue={orgData?.business_type ?? ""}
              placeholder="ej: Inmobiliaria, E-commerce"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">País</label>
            <select
              name="country"
              defaultValue={orgData?.country ?? "AR"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="AR">Argentina</option>
              <option value="MX">México</option>
              <option value="CO">Colombia</option>
              <option value="CL">Chile</option>
              <option value="PE">Perú</option>
              <option value="ES">España</option>
              <option value="US">Estados Unidos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Moneda</label>
            <select
              name="currency"
              defaultValue={orgData?.currency ?? "ARS"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ARS">ARS — Peso argentino</option>
              <option value="MXN">MXN — Peso mexicano</option>
              <option value="COP">COP — Peso colombiano</option>
              <option value="CLP">CLP — Peso chileno</option>
              <option value="PEN">PEN — Sol peruano</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dólar</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Zona horaria</label>
            <select
              name="timezone"
              defaultValue={orgData?.timezone ?? "America/Argentina/Buenos_Aires"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="America/Argentina/Buenos_Aires">Buenos Aires (UTC-3)</option>
              <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
              <option value="America/Bogota">Bogotá (UTC-5)</option>
              <option value="America/Santiago">Santiago (UTC-4)</option>
              <option value="America/Lima">Lima (UTC-5)</option>
              <option value="Europe/Madrid">Madrid (UTC+1/+2)</option>
              <option value="America/New_York">Nueva York (UTC-5)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">CUIT / RUT / NIF</label>
            <input
              name="tax_id"
              defaultValue={orgData?.tax_id ?? ""}
              placeholder="20-12345678-9"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Razón social</label>
            <input
              name="fiscal_name"
              defaultValue={orgData?.fiscal_name ?? ""}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
