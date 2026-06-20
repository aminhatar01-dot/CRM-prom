import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { requireUser } from "@/lib/auth";
import { createOrganization } from "./actions";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; slug?: string; suggestion?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships?.length) {
    redirect("/dashboard");
  }

  const errorMessage = onboardingErrorMessage(params.error, params.slug, params.suggestion);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Crear organizacion</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createOrganization} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" placeholder="Equipo Comercial" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug opcional</Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={params.suggestion ?? params.slug ?? ""}
                placeholder="equipo-comercial"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
            </div>
            {errorMessage ? (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              <Building2 className="size-4" />
              Crear workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function onboardingErrorMessage(error?: string, slug?: string, suggestion?: string) {
  if (!error) return null;
  if (error === "invalid-slug") {
    return "El slug solo puede contener letras minusculas, numeros y guiones.";
  }
  if (error === "slug-taken") {
    return suggestion
      ? `El slug "${slug}" ya existe. Prueba con "${suggestion}".`
      : "Ese slug ya existe. Prueba con otro.";
  }
  return "No pudimos crear la organizacion. Intenta nuevamente.";
}
