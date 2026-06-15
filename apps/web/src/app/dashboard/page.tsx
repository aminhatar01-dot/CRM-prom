import { Bot, LogOut, MessageSquareText, Tags, UsersRound } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { signOut } from "./actions";

type Membership = {
  role: string;
  organizations: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .returns<Membership[]>();

  const activeMembership = memberships?.[0];

  if (!activeMembership?.organizations) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Tu workspace todavía no existe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              CRM PRO AI necesita una organización para aislar datos, permisos y
              automatizaciones.
            </p>
            <Button asChild>
              <a href="/onboarding">Crear organización</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const organization = activeMembership.organizations;
  const [{ count: leads }, { count: conversations }, { count: tags }] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("tags")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id)
  ]);

  const stats = [
    { label: "Leads", value: leads ?? 0, icon: UsersRound },
    { label: "Conversaciones", value: conversations ?? 0, icon: MessageSquareText },
    { label: "Smart tags", value: tags ?? 0, icon: Tags },
    { label: "Asistentes IA", value: 0, icon: Bot }
  ];

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">CRM PRO AI</p>
            <h1 className="text-2xl font-semibold tracking-normal">{organization.name}</h1>
          </div>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              <LogOut className="size-4" />
              Salir
            </Button>
          </form>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Base operativa</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>Auth SSR activo, workspace multi tenant y RLS como frontera de datos.</p>
              <p>
                Las siguientes fases pueden montar inbox, pipeline, IA y automatizaciones sobre
                esta base sin cambiar el modelo de seguridad.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Usuario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
              <p className="pt-2 text-muted-foreground">Rol</p>
              <p className="font-medium">{activeMembership.role}</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
