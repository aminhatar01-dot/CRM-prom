import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { getServerEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { createEmbeddedSignupState } from "@/lib/whatsapp/credentials";
import { EmbeddedSignupButton } from "./_components/embedded-signup-button";

type WhatsAppSetting = {
  phone_number_id: string;
  business_account_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  enabled: boolean;
  connection_method: string;
  token_status: string;
  token_expires_at: string | null;
  connected_at: string | null;
};

export default async function WhatsAppSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const env = getServerEnv();
  const { data: setting } = await supabase
    .from("whatsapp_channel_settings")
    .select(
      "phone_number_id, business_account_id, display_phone_number, verified_name, quality_rating, enabled, connection_method, token_status, token_expires_at, connected_at",
    )
    .eq("organization_id", organization.id)
    .eq("enabled", true)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<WhatsAppSetting>();

  const embeddedReady = Boolean(
    env.META_APP_ID &&
      env.META_WHATSAPP_CONFIGURATION_ID &&
      env.WHATSAPP_APP_SECRET &&
      env.WHATSAPP_TOKEN_ENCRYPTION_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const canConnect = ["owner", "admin"].includes(organization.role);
  const state =
    embeddedReady && canConnect
      ? createEmbeddedSignupState({
          organizationId: organization.id,
          userId: user.id,
          appSecret: env.WHATSAPP_APP_SECRET!
        })
      : null;

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Canal WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conecta una cuenta oficial mediante Meta Embedded Signup.
        </p>
      </div>

      {params.connected ? (
        <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          WhatsApp fue conectado y suscrito al webhook correctamente.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>{setting ? "Cuenta conectada" : "Conectar WhatsApp"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {setting ? (
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info label="Telefono" value={setting.display_phone_number ?? "No informado"} />
                <Info label="Nombre verificado" value={setting.verified_name ?? "Pendiente"} />
                <Info label="WABA ID" value={setting.business_account_id ?? "No informado"} />
                <Info label="Phone Number ID" value={setting.phone_number_id} />
                <Info label="Calidad" value={setting.quality_rating ?? "Sin clasificar"} />
                <Info label="Token" value={tokenLabel(setting.token_status, setting.token_expires_at)} />
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No hay una cuenta de WhatsApp conectada a esta organizacion.
              </div>
            )}

            {embeddedReady && canConnect && state ? (
              <EmbeddedSignupButton
                appId={env.META_APP_ID!}
                configurationId={env.META_WHATSAPP_CONFIGURATION_ID!}
                graphApiVersion={env.WHATSAPP_GRAPH_API_VERSION}
                state={state}
              />
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {!canConnect
                  ? "Solo owner o admin puede conectar WhatsApp."
                  : "Embedded Signup requiere completar la configuracion global de Meta en Vercel."}
              </div>
            )}

            {setting?.connection_method === "manual" ? (
              <p className="text-xs text-muted-foreground">
                Esta cuenta usa la configuracion heredada. Puedes migrarla pulsando Conectar WhatsApp.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del canal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Status
              ok={embeddedReady}
              label="Embedded Signup"
              detail={embeddedReady ? "Configurado" : "Pendiente en Vercel"}
            />
            <Status
              ok={Boolean(setting?.enabled)}
              label="Cuenta de WhatsApp"
              detail={setting?.enabled ? "Activa" : "Sin conectar"}
            />
            <Status
              ok={setting?.token_status === "active"}
              label="Credencial"
              detail={setting ? tokenLabel(setting.token_status, setting.token_expires_at) : "Sin token"}
            />
            <Status
              ok={Boolean(env.WHATSAPP_VERIFY_TOKEN)}
              label="Webhook existente"
              detail={env.WHATSAPP_VERIFY_TOKEN ? "Listo" : "Falta variable global"}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium">{value}</p>
    </div>
  );
}

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
      ) : (
        <ShieldAlert className="mt-0.5 size-4 text-amber-600" />
      )}
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function tokenLabel(status: string, expiresAt: string | null) {
  if (status !== "active") return status;
  if (!expiresAt) return "Activo sin vencimiento informado";
  return `Activo hasta ${new Date(expiresAt).toLocaleDateString("es-AR")}`;
}
