import { CheckCircle2, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { saveWebchatWidget } from "@/app/actions/webchat";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type WidgetRow = {
  id: string;
  name: string;
  public_token: string;
  primary_color: string;
  initial_message: string;
  position: string;
  active: boolean;
  allowed_domains: string[];
  assistant_id: string | null;
};

export default async function WebChatSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: widget }, { data: assistants }] = await Promise.all([
    supabase
      .from("webchat_widgets")
      .select("id, name, public_token, primary_color, initial_message, position, active, allowed_domains, assistant_id")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<WidgetRow>(),
    supabase
      .from("ai_assistants")
      .select("id, name, channel_id")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .order("name")
      .returns<Array<{ id: string; name: string; channel_id: string | null }>>()
  ]);
  const token = widget?.public_token ?? "se-genera-al-guardar";
  const embed = `<script src="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/widget/crm-pro-ai-widget.js" data-widget-token="${token}" async></script>`;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Canal WebChat</h1>
        <p className="text-sm text-muted-foreground">
          Configura el widget embebible para capturar leads y conversaciones desde sitios externos.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Configuracion del widget</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveWebchatWidget} className="grid gap-4">
              {widget ? <input type="hidden" name="id" value={widget.id} /> : null}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del widget</Label>
                <Input id="name" name="name" defaultValue={widget?.name ?? "CRM PRO AI WebChat"} required />
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Label htmlFor="initial_message">Mensaje inicial</Label>
                  <Input id="initial_message" name="initial_message" defaultValue={widget?.initial_message ?? "Hola, como podemos ayudarte?"} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Color</Label>
                  <Input id="primary_color" name="primary_color" type="color" defaultValue={widget?.primary_color ?? "#0f766e"} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="position">Posicion</Label>
                  <select id="position" name="position" defaultValue={widget?.position ?? "bottom-right"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="bottom-right">bottom-right</option>
                    <option value="bottom-left">bottom-left</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant_id">Asistente asociado</Label>
                  <select id="assistant_id" name="assistant_id" defaultValue={widget?.assistant_id ?? ""} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Sin asistente</option>
                    {(assistants ?? []).map((assistant) => (
                      <option key={assistant.id} value={assistant.id}>
                        {assistant.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowed_domains">Dominios permitidos</Label>
                <textarea
                  id="allowed_domains"
                  name="allowed_domains"
                  defaultValue={(widget?.allowed_domains ?? ["localhost", "127.0.0.1"]).join("\n")}
                  className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="active" type="checkbox" defaultChecked={widget?.active ?? false} />
                Widget activo
              </label>
              {params.saved ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Configuracion guardada.</p> : null}
              {params.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">No pudimos guardar la configuracion.</p> : null}
              <Button type="submit">Guardar WebChat</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Token publico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted p-3 font-mono text-xs break-all">{token}</div>
              <div className="flex items-start gap-2">
                {widget?.active ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" /> : <ShieldAlert className="mt-0.5 size-4 text-amber-600" />}
                <p className="text-muted-foreground">{widget?.active ? "Widget listo para recibir conversaciones." : "El widget existe pero esta inactivo."}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Embed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{embed}</pre>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Copy className="size-3" />
                Usa el host de Vercel o localhost segun el entorno.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
