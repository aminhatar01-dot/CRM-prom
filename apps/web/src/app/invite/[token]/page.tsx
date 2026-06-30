import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { acceptInvitation } from "@/app/actions/team";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { OrganizationRole } from "@/lib/permissions/roles";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("organization_invitations")
    .select("id, email, role, expires_at, accepted_at, revoked_at, organizations(name)")
    .eq("token", token)
    .maybeSingle();

  if (!inv) {
    return <InviteError message="El enlace de invitacion no es valido o no existe." />;
  }
  if (inv.revoked_at) {
    return <InviteError message="Esta invitacion fue revocada por el administrador." />;
  }
  if (inv.accepted_at) {
    return <InviteError message="Esta invitacion ya fue utilizada." />;
  }
  if (new Date(inv.expires_at) < new Date()) {
    return <InviteError message="Esta invitacion ha expirado. Solicita una nueva al administrador." />;
  }

  const orgName = Array.isArray(inv.organizations)
    ? (inv.organizations[0] as { name: string } | undefined)?.name
    : (inv.organizations as { name: string } | null)?.name;

  let isAuthenticated = false;
  let userEmail: string | null = null;
  try {
    const { user } = await requireUser();
    isAuthenticated = true;
    userEmail = user.email ?? null;
  } catch {
    isAuthenticated = false;
  }

  async function handleAccept() {
    "use server";
    try {
      await acceptInvitation(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al aceptar la invitacion";
      redirect(`/invite/${token}?error=${encodeURIComponent(msg)}`);
    }
    redirect("/dashboard");
  }

  const roleLabel = ROLE_LABELS[inv.role as OrganizationRole] ?? inv.role;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">👋</div>
          <h1 className="text-xl font-bold">Te invitaron a unirte</h1>
          <p className="text-muted-foreground text-sm">
            <strong>{orgName ?? "una organizacion"}</strong> te invita como{" "}
            <strong>{roleLabel}</strong> en CRM PRO AI.
          </p>
          <p className="text-xs text-muted-foreground">
            Invitacion enviada a <strong>{inv.email}</strong>
          </p>
        </div>

        {isAuthenticated ? (
          <form action={handleAccept} className="space-y-3">
            {userEmail && userEmail.toLowerCase() !== inv.email.toLowerCase() && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Estas autenticado como <strong>{userEmail}</strong>, pero la invitacion es para{" "}
                <strong>{inv.email}</strong>. Asegurate de usar la cuenta correcta.
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Aceptar invitacion
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Para aceptar la invitacion, inicia sesion o crea una cuenta con{" "}
              <strong>{inv.email}</strong>.
            </p>
            <a
              href={`/login?redirect=/invite/${token}`}
              className="block w-full text-center rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Iniciar sesion
            </a>
            <a
              href={`/register?email=${encodeURIComponent(inv.email)}&redirect=/invite/${token}`}
              className="block w-full text-center rounded-md border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              Crear cuenta nueva
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm space-y-4 text-center">
        <div className="text-4xl">❌</div>
        <h1 className="text-xl font-bold">Invitacion no valida</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a
          href="/dashboard"
          className="inline-block rounded-md border px-6 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
