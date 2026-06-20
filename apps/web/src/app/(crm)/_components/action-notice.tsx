"use client";

import { useSearchParams } from "next/navigation";

const errorMessages: Record<string, string> = {
  invalid: "Revisa los campos ingresados.",
  duplicate: "Ya existe un registro con esos datos.",
  forbidden: "No tienes permisos para realizar esta accion.",
  "invalid-reference": "Uno de los registros relacionados ya no existe.",
  "tenant-integrity": "La operacion fue rechazada por aislamiento de organizacion.",
  "not-found": "El registro solicitado no existe o fue archivado.",
  database: "La base de datos rechazo la operacion. Intenta nuevamente.",
  create: "No pudimos crear el registro.",
  update: "No pudimos guardar los cambios.",
  archive: "No pudimos archivar el registro.",
  "create-conversation": "No pudimos crear la conversacion.",
  "create-message": "No pudimos guardar el mensaje.",
  "update-conversation": "No pudimos actualizar la conversacion."
};

const successMessages: Record<string, string> = {
  archived: "Registro archivado correctamente.",
  created: "Registro creado correctamente.",
  updated: "Cambios guardados correctamente."
};

export function ActionNotice() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const success = searchParams.get("success");

  if (!error && !success) return null;

  const message = error
    ? errorMessages[error] ?? "No pudimos completar la operacion."
    : successMessages[success ?? ""] ?? "Operacion completada.";

  return (
    <div className="px-4 pt-4 lg:px-6">
      <p
        role={error ? "alert" : "status"}
        className={`mx-auto max-w-6xl rounded-md border px-4 py-3 text-sm ${
          error
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
