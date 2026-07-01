import Link from "next/link";

export function LegalLayout({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-primary">CRM PRO AI</Link>
        <nav className="flex gap-4 text-xs text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground">Terminos</Link>
          <Link href="/legal/privacy" className="hover:text-foreground">Privacidad</Link>
          <Link href="/legal/cookies" className="hover:text-foreground">Cookies</Link>
          <Link href="/legal/data-processing" className="hover:text-foreground">DPA</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div className="space-y-1">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Documento borrador — debe ser revisado y aprobado por asesor legal antes de uso comercial masivo.
          </p>
          <h1 className="text-3xl font-bold pt-4">{title}</h1>
          <p className="text-sm text-muted-foreground">Ultima actualizacion: {lastUpdated}</p>
        </div>

        <div className="prose prose-sm max-w-none text-foreground space-y-4">
          {children}
        </div>

        <div className="border-t pt-6 text-xs text-muted-foreground">
          <p>Para consultas legales: <strong>legal@crm-pro-ai.com</strong></p>
          <p className="mt-1">
            <Link href="/legal/terms" className="hover:underline">Terminos</Link>
            {" · "}
            <Link href="/legal/privacy" className="hover:underline">Privacidad</Link>
            {" · "}
            <Link href="/legal/cookies" className="hover:underline">Cookies</Link>
            {" · "}
            <Link href="/legal/data-processing" className="hover:underline">DPA</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
