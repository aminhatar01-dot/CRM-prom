import { adminListPrivacyRequests, adminHandlePrivacyRequest } from "@/app/actions/legal";
import { redirect } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  pending:    "Pendiente",
  processing: "En proceso",
  completed:  "Completada",
  rejected:   "Rechazada",
  cancelled:  "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "text-yellow-300 bg-yellow-900/30",
  processing: "text-blue-300 bg-blue-900/30",
  completed:  "text-green-300 bg-green-900/30",
  rejected:   "text-red-300 bg-red-900/30",
  cancelled:  "text-gray-400 bg-gray-800/30",
};

const REQUEST_LABELS: Record<string, string> = {
  export_data:         "Exportar datos",
  delete_data:         "Eliminar datos",
  anonymize_contact:   "Anonimizar contacto",
  restrict_processing: "Restringir procesamiento",
};

export default async function AdminPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.success === "1";

  const requests = await adminListPrivacyRequests();

  const pending    = requests.filter((r) => r.status === "pending").length;
  const processing = requests.filter((r) => r.status === "processing").length;

  async function handleStatus(formData: FormData) {
    "use server";
    try {
      await adminHandlePrivacyRequest(
        formData.get("requestId") as string,
        formData.get("newStatus") as "processing" | "completed" | "rejected",
        formData.get("notes") as string | undefined,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/admin/privacy?error=${encodeURIComponent(msg)}`);
    }
    redirect("/admin/privacy?success=1");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Solicitudes de privacidad</h1>
        <p className="text-sm text-gray-400 mt-1">Gestiona solicitudes LGPD/GDPR de usuarios.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <p className="text-2xl font-bold text-yellow-400">{pending}</p>
          <p className="text-xs text-gray-400">Pendientes</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <p className="text-2xl font-bold text-blue-400">{processing}</p>
          <p className="text-xs text-gray-400">En proceso</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <p className="text-2xl font-bold text-gray-200">{requests.length}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
      </div>

      {saved && (
        <p className="rounded-md bg-green-900/30 border border-green-700 px-4 py-3 text-sm text-green-300">
          Solicitud actualizada correctamente.
        </p>
      )}
      {errorMsg && (
        <p className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No hay solicitudes de privacidad.</p>
      ) : (
        <div className="rounded-lg border border-gray-700 divide-y divide-gray-700 overflow-hidden">
          {requests.map((r) => (
            <div key={r.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">
                      {REQUEST_LABELS[r.request_type] ?? r.request_type}
                    </span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[r.status] ?? ""}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Org: <strong className="text-gray-200">{r.org_name}</strong>
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </p>
                  {r.reason && <p className="text-xs text-gray-400 mt-1">Motivo: {r.reason}</p>}
                  {r.notes && <p className="text-xs text-gray-300 mt-1">Nota: {r.notes}</p>}
                </div>
              </div>

              {(r.status === "pending" || r.status === "processing") && (
                <form action={handleStatus} className="flex flex-wrap gap-2 items-end">
                  <input type="hidden" name="requestId" value={r.id} />
                  <input
                    name="notes"
                    placeholder="Notas (opcional)"
                    className="flex-1 min-w-36 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200"
                  />
                  {r.status === "pending" && (
                    <>
                      <button
                        type="submit"
                        name="newStatus"
                        value="processing"
                        className="rounded bg-blue-700 hover:bg-blue-600 px-3 py-1 text-xs text-white transition-colors"
                      >
                        En proceso
                      </button>
                      <button
                        type="submit"
                        name="newStatus"
                        value="rejected"
                        className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1 text-xs text-gray-200 transition-colors"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {r.status === "processing" && (
                    <button
                      type="submit"
                      name="newStatus"
                      value="completed"
                      className="rounded bg-green-700 hover:bg-green-600 px-3 py-1 text-xs text-white transition-colors"
                    >
                      Completar
                    </button>
                  )}
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
