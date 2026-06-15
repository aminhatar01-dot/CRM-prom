import { Mail } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { signInWithEmail } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar a CRM PRO AI</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signInWithEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {params.sent ? (
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
                Te enviamos un enlace de acceso.
              </p>
            ) : null}
            {params.error ? (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                No pudimos iniciar sesión. Revisá el email e intentá de nuevo.
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              <Mail className="size-4" />
              Enviar magic link
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
