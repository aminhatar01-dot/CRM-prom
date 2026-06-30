import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageTeam, ROLE_LABELS, INVITABLE_ROLES } from "@/lib/permissions/roles";
import type { OrganizationRole } from "@/lib/permissions/roles";
import {
  getTeamData,
  inviteMember,
  revokeInvitation,
  resendInvitation,
  updateMemberRole,
  removeMember,
} from "@/app/actions/team";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { user } = await requireUser();
  const { members, invitations, role } = await getTeamData();

  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.success === "1";

  const isAdmin = canManageTeam(role);

  async function handleInvite(formData: FormData) {
    "use server";
    try {
      await inviteMember(
        formData.get("email") as string,
        formData.get("role") as OrganizationRole,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      redirect(`/settings/team?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/team?success=1");
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra los miembros y permisos de tu organizacion.
        </p>
      </div>

      {saved && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Operacion completada correctamente.
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </p>
      )}

      {isAdmin && (
        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Invitar miembro
          </h2>
          <form action={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              name="email"
              type="email"
              required
              placeholder="email@empresa.com"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              name="role"
              defaultValue="agent"
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Enviar invitacion
            </button>
          </form>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Miembros ({members.length})
        </h2>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No hay miembros aun.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {members.map((m) => {
              const isMe = m.user_id === user.id;
              const isOwner = m.role === "owner";

              return (
                <div key={m.id} className="flex items-center gap-4 p-4">
                  <div className="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                    {(m.profiles?.full_name ?? "?")[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.profiles?.full_name ?? "Sin nombre"}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(tu)</span>}
                    </p>
                    {m.profiles?.job_title && (
                      <p className="text-xs text-muted-foreground">{m.profiles.job_title}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && !isOwner && !isMe ? (
                      <form
                        action={async (fd: FormData) => {
                          "use server";
                          try {
                            await updateMemberRole(fd.get("memberId") as string, fd.get("newRole") as OrganizationRole);
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Error";
                            redirect(`/settings/team?error=${encodeURIComponent(msg)}`);
                          }
                          redirect("/settings/team?success=1");
                        }}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="memberId" value={m.id} />
                        <select
                          name="newRole"
                          defaultValue={m.role}
                          className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {INVITABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        <button type="submit" className="text-xs text-primary hover:underline">
                          Cambiar
                        </button>
                      </form>
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
                        {ROLE_LABELS[m.role as OrganizationRole] ?? m.role}
                      </span>
                    )}

                    {isAdmin && !isOwner && !isMe && (
                      <form
                        action={async (fd: FormData) => {
                          "use server";
                          try {
                            await removeMember(fd.get("memberId") as string);
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Error";
                            redirect(`/settings/team?error=${encodeURIComponent(msg)}`);
                          }
                          redirect("/settings/team?success=1");
                        }}
                      >
                        <input type="hidden" name="memberId" value={m.id} />
                        <button type="submit" className="text-xs text-destructive hover:underline">
                          Eliminar
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {invitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Invitaciones pendientes ({invitations.length})
          </h2>

          <div className="rounded-lg border divide-y">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[inv.role]} &middot; Expira {new Date(inv.expires_at).toLocaleDateString("es-AR")}
                    {inv.resend_count > 0 && ` · Reenviada ${inv.resend_count}×`}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-3 shrink-0">
                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        try {
                          await resendInvitation(fd.get("invId") as string);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Error";
                          redirect(`/settings/team?error=${encodeURIComponent(msg)}`);
                        }
                        redirect("/settings/team?success=1");
                      }}
                    >
                      <input type="hidden" name="invId" value={inv.id} />
                      <button type="submit" className="text-xs text-primary hover:underline">
                        Reenviar
                      </button>
                    </form>

                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        try {
                          await revokeInvitation(fd.get("invId") as string);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Error";
                          redirect(`/settings/team?error=${encodeURIComponent(msg)}`);
                        }
                        redirect("/settings/team?success=1");
                      }}
                    >
                      <input type="hidden" name="invId" value={inv.id} />
                      <button type="submit" className="text-xs text-destructive hover:underline">
                        Revocar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border bg-muted/30 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Guia de roles</h2>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Propietario:</strong> Control total. Solo puede haber uno.</p>
          <p><strong>Administrador:</strong> Gestiona equipo, integraciones y configuracion.</p>
          <p><strong>Supervisor:</strong> Acceso de lectura a reportes y contactos. No modifica configuracion.</p>
          <p><strong>Agente:</strong> Usa Inbox, gestiona contactos y leads.</p>
          <p><strong>Miembro:</strong> Acceso basico al CRM. Sin configuracion.</p>
          <p><strong>Visor:</strong> Solo lectura. No puede interactuar con clientes.</p>
        </div>
      </section>
    </div>
  );
}
