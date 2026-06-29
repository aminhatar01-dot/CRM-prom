import { requireSuperAdmin } from "@/lib/admin/auth";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, platformRole } = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-red-900/50 bg-red-950/30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-widest text-red-400 border border-red-800 px-2 py-0.5 rounded">
            ADMIN
          </span>
          <span className="text-sm text-gray-400">CRM PRO AI — Panel Interno</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{user.email}</span>
          <span className="bg-red-900/50 text-red-300 px-2 py-0.5 rounded font-mono">{platformRole}</span>
          <Link href="/dashboard" className="text-gray-400 hover:text-white">← App</Link>
        </div>
      </header>

      <div className="flex">
        <nav className="w-52 min-h-screen border-r border-gray-800 p-4 space-y-1 shrink-0">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/organizations">Organizaciones</NavLink>
          <NavLink href="/admin/plans">Planes</NavLink>
          <NavLink href="/admin/credits">Créditos</NavLink>
          <NavLink href="/admin/system">Sistema</NavLink>
        </nav>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
