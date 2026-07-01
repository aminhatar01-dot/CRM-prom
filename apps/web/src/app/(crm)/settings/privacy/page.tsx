import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getConsentStatus,
  getMyAcceptances,
  getMyPrivacyRequests,
  getActiveDocuments,
  acceptDocument,
  grantAiConsent,
  createPrivacyRequest,
  cancelPrivacyRequest,
} from "@/app/actions/legal";

const REQUEST_LABELS: Record<string, string> = {
  export_data:         "Exportar mis datos",
  delete_data:         "Eliminar mis datos",
  anonymize_contact:   "Anonimizar contacto",
  restrict_processing: "Restringir procesamiento",
};

const STATUS_LABELS: Record<string, string> = {
  pending:    "Pendiente",
  processing: "En proceso",
  completed:  "Completada",
  rejected:   "Rechazada",
  cancelled:  "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "text-yellow-700 bg-yellow-50 border-yellow-200",
  processing: "text-blue-700 bg-blue-50 border-blue-200",
  completed:  "text-green-700 bg-green-50 border-green-200",
  rejected:   "text-red-700 bg-red-50 border-red-200",
  cancelled:  "text-gray-700 bg-gray-50 border-gray-200",
};

export default async function PrivacySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.success === "1";

  const [consent, acceptances, requests, docs] = await Promise.all([
    getConsentStatus(),
    getMyAcceptances(),
    getMyPrivacyRequests(),
    getActiveDocuments(),
  ]);

  async function handleAcceptDoc(formData: FormData) {
    "use server";
    try {
      await acceptDocument(formData.get("docType") as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/settings/privacy?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/privacy?success=1");
  }

  async function handleAiConsent() {
    "use server";
    try {
      await grantAiConsent();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/settings/privacy?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/privacy?success=1");
  }

  async function handleExportRequest() {
    "use server";
    try {
      await createPrivacyRequest("export_data");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/settings/privacy?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/privacy?success=1");
  }

  async function handleDeleteRequest(formData: FormData) {
    "use server";
    try {
      await createPrivacyRequest("delete_data", { reason: formData.get("reason") as string });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/settings/privacy?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/privacy?success=1");
  }

  async function handleCancelRequest(formData: FormData) {
    "use server";
    try {
      await cancelPrivacyRequest(formData.get("requestId") as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/settings/privacy?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/privacy?success=1");
  }

  const docMap = Object.fromEntries(docs.map((d) => [d.doc_type, d]));

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Privacidad y datos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona tus consentimientos legales, exportaciones y solicitudes de privacidad.
        </p>
      </div>

      {saved && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Cambios guardados correctamente.
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </p>
      )}

      {/* Consent status */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Documentos legales aceptados
        </h2>

        {[
          { key: "terms",           label: "Terminos y Condiciones", href: "/legal/terms" },
          { key: "privacy",         label: "Politica de Privacidad",  href: "/legal/privacy" },
          { key: "data_processing", label: "Acuerdo de Datos (DPA)",  href: "/legal/data-processing" },
          { key: "ai_consent",      label: "Consentimiento IA",        href: "/legal/terms" },
        ].map(({ key, label, href }) => {
          const isAccepted = key === "terms" ? consent.terms
            : key === "privacy" ? consent.privacy
            : key === "data_processing" ? consent.data_processing
            : consent.ai_consent;
          const doc = docMap[key];

          return (
            <div key={key} className="flex items-center justify-between gap-4 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  <Link href={href} className="hover:underline" target="_blank">{label}</Link>
                  {doc && <span className="ml-2 text-xs text-muted-foreground">v{doc.version}</span>}
                </p>
              </div>
              <div className="shrink-0">
                {isAccepted ? (
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Aceptado</span>
                ) : key === "ai_consent" ? (
                  <form action={handleAiConsent}>
                    <button type="submit" className="text-xs text-primary hover:underline">
                      Aceptar
                    </button>
                  </form>
                ) : (
                  <form action={handleAcceptDoc}>
                    <input type="hidden" name="docType" value={key} />
                    <button type="submit" className="text-xs text-primary hover:underline">
                      Aceptar
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground pt-2 border-t">
          Al aceptar los documentos confirmas haber leido y comprendido su contenido. Ver:{" "}
          <Link href="/legal/terms" className="hover:underline" target="_blank">Terminos</Link>
          {" · "}
          <Link href="/legal/privacy" className="hover:underline" target="_blank">Privacidad</Link>
          {" · "}
          <Link href="/legal/data-processing" className="hover:underline" target="_blank">DPA</Link>
        </p>
      </section>

      {/* Acceptance history */}
      {acceptances.length > 0 && (
        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de aceptaciones
          </h2>
          <div className="divide-y text-sm">
            {acceptances.slice(0, 10).map((a) => (
              <div key={a.id} className="flex justify-between py-2">
                <span className="text-muted-foreground">{a.doc_type} v{a.version}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.accepted_at).toLocaleDateString("es-AR")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI consent section */}
      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Procesamiento con inteligencia artificial
        </h2>
        <p className="text-sm text-muted-foreground">
          CRM PRO AI utiliza modelos de IA externos (OpenAI) para procesar el contenido de conversaciones y generar respuestas automaticas. Los datos de conversaciones son enviados al proveedor de IA cuando el asistente esta activo.
        </p>
        {consent.ai_consent ? (
          <p className="text-sm text-green-700">Consentimiento IA activo. Los asistentes pueden procesar conversaciones.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Sin consentimiento IA activo. Los asistentes no podran procesar conversaciones con modelos externos.
            </p>
            <form action={handleAiConsent}>
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                Otorgar consentimiento IA
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Privacy requests */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Solicitudes de privacidad
        </h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <form action={handleExportRequest} className="rounded-md border p-4 space-y-2">
            <p className="text-sm font-medium">Exportar mis datos</p>
            <p className="text-xs text-muted-foreground">Solicita una exportacion de todos los datos de tu organizacion en formato JSON.</p>
            <button type="submit" className="mt-1 text-xs text-primary hover:underline">
              Solicitar exportacion
            </button>
          </form>

          <form action={handleDeleteRequest} className="rounded-md border p-4 space-y-2">
            <p className="text-sm font-medium">Solicitar eliminacion</p>
            <p className="text-xs text-muted-foreground">Solicita la eliminacion de los datos de tu organizacion. El equipo de soporte revisara la solicitud.</p>
            <textarea name="reason" rows={2} placeholder="Motivo (opcional)" className="w-full text-xs rounded border bg-background px-2 py-1 mt-1" />
            <button type="submit" className="text-xs text-destructive hover:underline">
              Solicitar eliminacion
            </button>
          </form>
        </div>

        {requests.length > 0 && (
          <div className="divide-y">
            <p className="text-xs font-medium text-muted-foreground pb-2">Tus solicitudes</p>
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{REQUEST_LABELS[r.request_type] ?? r.request_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                    {r.notes && ` · ${r.notes}`}
                  </p>
                  {r.export_url && r.status === "completed" && (
                    <a href={r.export_url} className="text-xs text-primary hover:underline" download>
                      Descargar exportacion
                    </a>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-xs rounded-full border px-2 py-0.5 ${STATUS_COLORS[r.status] ?? ""}`}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  {r.status === "pending" && (
                    <form action={handleCancelRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button type="submit" className="text-xs text-muted-foreground hover:underline">
                        Cancelar
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground border-t pt-3">
          Para intervenciones manuales o consultas: <strong>privacidad@crm-pro-ai.com</strong>
        </p>
      </section>

      {/* Links */}
      <section className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">Documentos legales</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/legal/terms" className="hover:underline" target="_blank">Terminos y Condiciones</Link>
          <Link href="/legal/privacy" className="hover:underline" target="_blank">Politica de Privacidad</Link>
          <Link href="/legal/cookies" className="hover:underline" target="_blank">Politica de Cookies</Link>
          <Link href="/legal/data-processing" className="hover:underline" target="_blank">Acuerdo DPA</Link>
        </div>
      </section>
    </div>
  );
}
