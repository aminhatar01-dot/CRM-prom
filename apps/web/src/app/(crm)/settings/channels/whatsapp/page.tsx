import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { saveWhatsAppSettings } from "@/app/actions/crm";
import { getServerEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type WhatsAppSetting = {
  phone_number_id: string;
  business_account_id: string | null;
  display_phone_number: string | null;
  webhook_verify_token_hint: string | null;
  enabled: boolean;
};

export default async function WhatsAppSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const env = getServerEnv();
  const { data: setting } = await supabase
    .from("whatsapp_channel_settings")
    .select("phone_number_id, business_account_id, display_phone_number, webhook_verify_token_hint, enabled")
    .eq("organization_id", organization.id)
    .limit(1)
    .maybeSingle<WhatsAppSetting>();

  const checks = [
    { label: "WHATSAPP_VERIFY_TOKEN", ok: Boolean(env.WHATSAPP_VERIFY_TOKEN) },
    { label: "WHATSAPP_ACCESS_TOKEN", ok: Boolean(env.WHATSAPP_ACCESS_TOKEN) },
    { label: "SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) },
    { label: "WHATSAPP_APP_SECRET", ok: Boolean(env.WHATSAPP_APP_SECRET), optional: true }
  ];

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Canal WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Configura WhatsApp Cloud API para recibir webhooks y enviar mensajes manuales.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle>Configuracion del canal</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveWhatsAppSettings} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone_number_id">Phone Number ID</Label>
                <Input id="phone_number_id" name="phone_number_id" defaultValue={setting?.phone_number_id ?? env.WHATSAPP_PHONE_NUMBER_ID ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_account_id">WhatsApp Business Account ID</Label>
                <Input id="business_account_id" name="business_account_id" defaultValue={setting?.business_account_id ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_phone_number">Telefono visible</Label>
                <Input id="display_phone_number" name="display_phone_number" defaultValue={setting?.display_phone_number ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook_verify_token_hint">Referencia del verify token</Label>
                <Input id="webhook_verify_token_hint" name="webhook_verify_token_hint" defaultValue={setting?.webhook_verify_token_hint ?? ""} placeholder="No pegues secretos completos aqui" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="enabled" type="checkbox" defaultChecked={setting?.enabled ?? false} />
                Canal habilitado
              </label>
              {params.saved ? (
                <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Configuracion guardada.</p>
              ) : null}
              {params.error ? (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">No pudimos guardar la configuracion.</p>
              ) : null}
              <Button type="submit">Guardar WhatsApp</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checks.map((check) => (
              <div key={check.label} className="flex items-start gap-2 text-sm">
                {check.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="mt-0.5 size-4 text-amber-600" />
                )}
                <div>
                  <p className="font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {check.ok ? "Configurada" : check.optional ? "Opcional, recomendada para firmas" : "Pendiente"}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
