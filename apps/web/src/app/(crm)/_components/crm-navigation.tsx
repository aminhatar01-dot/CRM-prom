"use client";

import Link from "next/link";
import { Bot, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@crm-pro-ai/ui/button";
import { cn } from "@crm-pro-ai/ui/utils";
import { navigationForRole } from "@/lib/navigation/main-nav";

export function DesktopNavigation({
  organizationName,
  role
}: {
  organizationName: string;
  role: string;
}) {
  const pathname = usePathname();
  const nav = navigationForRole(role);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card lg:block">
        <Link href="/dashboard" className="flex h-16 items-center gap-2 border-b px-5">
          <Bot className="size-5 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">CRM PRO AI</p>
            <p className="truncate text-xs text-muted-foreground">{organizationName}</p>
          </div>
        </Link>
        <nav className="space-y-1 px-3 py-4">
          {nav.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(
                "w-full justify-start",
                isCurrentPath(pathname, item.href) && "bg-muted text-foreground",
              )}
            >
              <Link href={item.href}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
    </aside>
  );
}

export function MobileNavigation({ role }: { role: string }) {
  const pathname = usePathname();
  const nav = navigationForRole(role);

  return (
    <details className="relative lg:hidden">
        <summary
          className="inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-md border bg-background hover:bg-muted"
          aria-label="Abrir navegacion"
        >
          <Menu className="size-5" />
        </summary>
        <nav className="absolute left-0 top-12 z-50 grid w-72 gap-1 border bg-card p-2 shadow-lg">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-2 rounded-md px-3 text-sm hover:bg-muted",
                isCurrentPath(pathname, item.href) && "bg-muted font-medium",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
    </details>
  );
}

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}
