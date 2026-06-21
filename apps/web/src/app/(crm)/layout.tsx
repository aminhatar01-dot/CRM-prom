import { Suspense } from "react";
import { Button } from "@crm-pro-ai/ui/button";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { signOut } from "../dashboard/actions";
import { ActionNotice } from "./_components/action-notice";
import { DesktopNavigation, MobileNavigation } from "./_components/crm-navigation";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  return (
    <main className="min-h-screen bg-background">
      <DesktopNavigation organizationName={organization.name} role={organization.role} />
      <section className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <MobileNavigation role={organization.role} />
            <div>
              <p className="text-sm font-semibold">CRM PRO AI</p>
              <p className="text-xs text-muted-foreground">{organization.name}</p>
            </div>
          </div>
          <div className="hidden lg:block" />
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Salir
            </Button>
          </form>
        </header>
        <Suspense>
          <ActionNotice />
        </Suspense>
        {children}
      </section>
    </main>
  );
}
