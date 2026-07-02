import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { updateProfile, changePassword } from "@/app/actions/profile";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { supabase, user } = await requireUser();

  // Use user's supabase client — RLS allows users to read their own profile.
  // Avoids createAdminClient() throwing if SUPABASE_SERVICE_ROLE_KEY is absent.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, phone, job_title, preferred_language, timezone")
    .eq("id", user.id)
    .maybeSingle();

  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.success === "1";
  const pwSaved = sp.success === "pw";

  async function handleProfileSubmit(formData: FormData) {
    "use server";
    try {
      await updateProfile({
        full_name:          formData.get("full_name") as string,
        phone:              formData.get("phone") as string,
        job_title:          formData.get("job_title") as string,
        preferred_language: formData.get("preferred_language") as string,
        timezone:           formData.get("timezone") as string,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      redirect(`/settings/profile?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/profile?success=1");
  }

  async function handlePasswordSubmit(formData: FormData) {
    "use server";
    try {
      await changePassword(
        formData.get("current_password") as string,
        formData.get("new_password") as string,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      redirect(`/settings/profile?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/profile?success=pw");
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tu información personal dentro de esta organización.
        </p>
      </div>

      {(saved || pwSaved) && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {pwSaved ? "Contraseña actualizada correctamente." : "Perfil guardado correctamente."}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </p>
      )}

      {/* Profile form */}
      <form action={handleProfileSubmit} className="space-y-4">
        <h2 className="text-base font-semibold">Datos personales</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Nombre completo *</label>
            <input
              name="full_name"
              required
              defaultValue={profile?.full_name ?? ""}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              value={user.email ?? ""}
              disabled
              className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
              placeholder="+54 11 0000-0000"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cargo / Rol</label>
            <input
              name="job_title"
              defaultValue={profile?.job_title ?? ""}
              placeholder="ej: Gerente comercial"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Idioma preferido</label>
            <select
              name="preferred_language"
              defaultValue={profile?.preferred_language ?? "es"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Zona horaria</label>
            <select
              name="timezone"
              defaultValue={profile?.timezone ?? "America/Argentina/Buenos_Aires"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="America/Argentina/Buenos_Aires">Buenos Aires (UTC-3)</option>
              <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
              <option value="America/Bogota">Bogotá (UTC-5)</option>
              <option value="America/Santiago">Santiago (UTC-4)</option>
              <option value="America/Lima">Lima (UTC-5)</option>
              <option value="Europe/Madrid">Madrid (UTC+1/+2)</option>
              <option value="America/New_York">Nueva York (UTC-5)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Guardar perfil
          </button>
        </div>
      </form>

      {/* Password form */}
      <form action={handlePasswordSubmit} className="space-y-4 pt-4 border-t">
        <h2 className="text-base font-semibold">Cambiar contraseña</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Contraseña actual *</label>
            <input
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nueva contraseña *</label>
            <input
              name="new_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md border px-6 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cambiar contraseña
          </button>
        </div>
      </form>
    </div>
  );
}
