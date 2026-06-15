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
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Crear organización</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createOrganization} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" placeholder="Equipo Comercial" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="equipo-comercial" required />
            </div>
            {params.error ? (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                No pudimos crear la organización. Usá un slug válido y único.
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
