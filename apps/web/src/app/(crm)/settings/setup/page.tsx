import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, Database, MessageSquareText, Settings2, Workflow } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { requireUser } from "@/lib/auth";
import { loadSetupStatus } from "@/lib/onboarding/status";
import { getActiveOrganization } from "@/lib/organization";

export default async function SetupStatusPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const status = await loadSetupStatus(supabase, organization.id);
  const metrics = [
    [Bot, "Asistentes activos", String(status.assistantsCount), `${status.autoReplyAssistants} con IA automática habilitada`],
    [Database, "Fuentes indexadas", String(status.knowledgeCount), status.catalogReady ? "Catálogo disponible" : "Sin catálogo detectable"],
    [MessageSquareText, "WhatsApp", status.whatsapp.connected ? "Conectado" : "Pendiente", status.whatsapp.phone ?? status.whatsapp.tokenStatus],
    [Workflow, "Automatizaciones", String(status.activeAutomations), "reglas activas"]
  ] as const;
  return <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Estado de configuración</h1><p className="text-sm text-muted-foreground">Preparación operativa de {organization.name}.</p></div><Button asChild><Link href="/onboarding"><Settings2 className="size-4"/>Abrir onboarding guiado</Link></Button></div>
    <div className="rounded-md border p-5"><div className="flex items-center justify-between"><span className="font-medium">Configuración completada</span><strong className="text-3xl">{status.percentage}%</strong></div><div className="mt-4 h-3 overflow-hidden rounded-md bg-muted"><div className="h-full bg-emerald-600" style={{width:`${status.percentage}%`}}/></div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{metrics.map(([Icon,label,value,detail])=><div key={label} className="rounded-md border p-4"><Icon className="size-5 text-primary"/><p className="mt-3 text-sm text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>)}</div>
    <div className="grid gap-4 md:grid-cols-2"><div className="rounded-md border p-4"><h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-amber-600"/>Tareas pendientes</h2><div className="mt-3 space-y-2 text-sm">{status.tasks.length ? status.tasks.map((item)=><p key={item}>{item}</p>) : <p className="text-emerald-700">No hay tareas críticas pendientes.</p>}</div></div><div className="rounded-md border p-4"><h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-emerald-600"/>Recomendaciones</h2><div className="mt-3 space-y-2 text-sm">{status.recommendations.map((item)=><p key={item}>{item}</p>)}</div></div></div>
  </section>;
}
