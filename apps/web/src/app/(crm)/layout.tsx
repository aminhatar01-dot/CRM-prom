import Link from "next/link";
import { Bot, Braces, LayoutDashboard, MessageSquareText, Plug, Settings, Sparkles, Tags, UsersRound, Workflow } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { signOut } from "../dashboard/actions";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);

  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads", label: "Leads", icon: UsersRound },
    { href: "/contacts", label: "Contactos", icon: UsersRound },
    { href: "/inbox", label: "Inbox", icon: MessageSquareText },
    { href: "/assistants", label: "Asistentes", icon: Sparkles },
    { href: "/smart-tags", label: "Smart Tags", icon: Tags },
    { href: "/variables", label: "Variables", icon: Braces },
    { href: "/automations", label: "Automatizaciones", icon: Workflow },
    { href: "/integrations", label: "Integraciones", icon: Plug },
    { href: "/settings/channels/webchat", label: "WebChat", icon: MessageSquareText },
    { href: "/settings/channels/whatsapp", label: "WhatsApp", icon: Settings }
  ];

  return (
    <main className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Bot className="size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">CRM PRO AI</p>
            <p className="text-xs text-muted-foreground">{organization.name}</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {nav.map((item) => (
            <Button key={item.href} asChild variant="ghost" className="w-full justify-start">
              <Link href={item.href}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
      </aside>
      <section className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="lg:hidden">
            <p className="text-sm font-semibold">CRM PRO AI</p>
            <p className="text-xs text-muted-foreground">{organization.name}</p>
          </div>
          <div className="hidden lg:block" />
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Salir
            </Button>
          </form>
        </header>
        {children}
      </section>
    </main>
  );
}
