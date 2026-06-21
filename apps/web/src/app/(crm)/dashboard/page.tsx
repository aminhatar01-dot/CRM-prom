import Link from "next/link";
import {
  Bot,
  MessageSquareText,
  Plus,
  Tags,
  UserRoundPlus,
  UsersRound
} from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [
    { count: leads },
    { count: conversations },
    { count: tags },
    { count: assistants },
    { data: recentLeads }
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id).is("archived_at", null),
    supabase.from("conversations").select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id).is("archived_at", null),
    supabase.from("tags").select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id).is("archived_at", null),
    supabase.from("ai_assistants").select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id).is("archived_at", null),
    supabase
      .from("leads")
      .select("id, first_name, last_name, status, created_at")
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const stats = [
    { label: "Leads", value: leads ?? 0, icon: UsersRound, href: "/leads" },
    { label: "Conversaciones", value: conversations ?? 0, icon: MessageSquareText, href: "/inbox" },
    { label: "Smart Tags", value: tags ?? 0, icon: Tags, href: "/smart-tags" },
    { label: "Asistentes IA", value: assistants ?? 0, icon: Bot, href: "/assistants" }
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {organization.name} · {organization.role} · {user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/contacts/new">
              <UserRoundPlus className="size-4" />
              Nuevo contacto
            </Link>
          </Button>
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="size-4" />
              Nuevo lead
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="block">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{stat.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">Abrir modulo</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Leads recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentLeads ?? []).map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between border-b py-3 text-sm last:border-0 hover:text-primary"
              >
                <span>{[lead.first_name, lead.last_name].filter(Boolean).join(" ")}</span>
                <span className="rounded-md border px-2 py-1 text-xs">{lead.status}</span>
              </Link>
            ))}
            {recentLeads?.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Todavia no hay leads. Crea el primero para iniciar el flujo comercial.
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acciones operativas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/inbox">Abrir Inbox</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/assistants/new">Crear asistente</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/automations/new">Crear automatizacion</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/integrations/new">Crear integracion</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
