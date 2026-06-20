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
  const errorMessage = loginErrorMessage(params.error);

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
            {errorMessage ? (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
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

function loginErrorMessage(error?: string) {
  if (!error) return null;
  if (error === "invalid-email") return "Ingresa un email valido.";
  if (error === "rate-limit") return "Espera un minuto antes de solicitar otro enlace.";
  if (error === "missing-code") return "El enlace esta incompleto. Solicita uno nuevo.";
  if (error === "callback" || error === "session") {
    return "El enlace vencio o ya fue utilizado. Solicita uno nuevo desde este navegador.";
  }
  if (error === "membership") {
    return "La sesion se creo, pero no pudimos consultar tu organizacion. Intenta nuevamente.";
  }
  return "No pudimos iniciar sesion. Revisa el email e intenta de nuevo.";
}
