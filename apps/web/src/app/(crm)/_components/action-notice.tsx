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
  "update-conversation": "No pudimos actualizar la conversacion.",
  "ai-suggestion": "No pudimos generar la sugerencia. Revisa la configuracion de OpenAI o intenta nuevamente.",
  ai: "No pudimos completar la solicitud de IA. Revisa la configuracion o intenta nuevamente.",
  "ai-tags": "No pudimos analizar los Smart Tags con IA.",
  "ai-variables": "No pudimos extraer variables con IA.",
  "no-assistant": "No hay un asistente activo para esta conversacion.",
  "no-smart-tags": "No hay Smart Tags activos para analizar.",
  "no-variables": "No hay Variables Inteligentes activas para extraer.",
  "knowledge-indexing": "El documento se guardo, pero no pudo indexarse. Revisa el estado y vuelve a intentar.",
  "draft-not-found": "El borrador ya fue enviado, descartado o no existe.",
  "draft-recipient-missing": "No pudimos enviar el borrador porque la conversacion no tiene telefono de WhatsApp.",
  "draft-whatsapp-config": "No pudimos enviar el borrador porque WhatsApp no esta configurado para esta organizacion.",
  "draft-whatsapp-api": "WhatsApp rechazo el envio del borrador. Revisa el canal o intenta nuevamente.",
  "draft-send-failed": "No pudimos enviar el borrador IA. El error quedo registrado en la conversacion."
  ,"quote-not_quote": "El ultimo mensaje no contiene una solicitud clara de cotizacion."
  ,"quote-missing_product": "No encontramos un producto verificable en el catalogo."
  ,"quote-missing_quantity": "Falta la cantidad solicitada. Preguntasela al cliente antes de cotizar."
  ,"quote-ambiguous": "Hay varias coincidencias posibles. El cliente debe elegir una opcion."
  ,"quote-missing_price": "El producto no tiene un precio verificable y requiere revision humana."
  ,"quote-currency_mismatch": "Los items usan monedas diferentes y requieren revision humana."
  ,"quote-failed": "No pudimos generar la cotizacion desde la conversacion."
};

const successMessages: Record<string, string> = {
  archived: "Registro archivado correctamente.",
  created: "Registro creado correctamente.",
  updated: "Cambios guardados correctamente.",
  indexed: "Documento indexado correctamente."
  ,sent: "Cotizacion enviada por WhatsApp y registrada correctamente."
  ,generated: "Cotizacion preliminar generada desde la conversacion."
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
