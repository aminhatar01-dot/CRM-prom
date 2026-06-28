import type { HubProvider, HubConnection, HubToolDefinition, HubToolResult, ConnectionHealth, ToolContext } from "../hub-provider";
import * as gmailApi from "./api";
import * as calApi from "./api";
import * as sheetsApi from "./api";
import * as driveApi from "./api";

const REQUIRES_APPROVAL_TOOLS = new Set([
  "send_email",
  "create_event",
  "append_row",
  "update_row",
]);

async function getToken(context: ToolContext | undefined, connectionId: string): Promise<string> {
  const token = await context?.getCredential?.("access_token");
  if (!token) throw new Error(`No access token for connection ${connectionId}. Please reconnect this Google integration.`);
  return token;
}

function requiresApproval(toolKey: string, context?: ToolContext): HubToolResult | null {
  if (!REQUIRES_APPROVAL_TOOLS.has(toolKey)) return null;
  const needsApproval = context?.requireHumanApproval !== false;
  if (needsApproval) {
    return {
      success: false,
      error:   `Tool "${toolKey}" requires human approval before executing. Enable auto-approval on the assistant settings to proceed automatically.`,
      durationMs: 0,
      data: { requiresApproval: true, toolKey },
    };
  }
  return null;
}

// ─── Gmail ────────────────────────────────────────────────────────────────────

export class RealGmailProvider implements HubProvider {
  readonly key = "gmail";
  readonly name = "Gmail";
  readonly category = "productivity" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Leer, enviar y gestionar correos de Gmail.";
  readonly iconEmoji = "📧";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "send_email",
        name: "Enviar email",
        description: "Envía un correo electrónico desde la cuenta conectada. Requiere aprobación humana por defecto.",
        inputSchema: {
          to:      { type: "string",  description: "Email del destinatario", required: true },
          subject: { type: "string",  description: "Asunto del correo", required: true },
          body:    { type: "string",  description: "Cuerpo del mensaje (texto o HTML)", required: true },
          cc:      { type: "string",  description: "Email en copia" },
        },
      },
      {
        key: "search_emails",
        name: "Buscar emails",
        description: "Busca correos usando la sintaxis de Gmail.",
        inputSchema: {
          query: { type: "string", description: "Término de búsqueda (Gmail query syntax)", required: true },
          limit: { type: "number", description: "Máximo de resultados (default 10)" },
        },
      },
      {
        key: "read_email",
        name: "Leer email",
        description: "Lee el contenido completo de un email.",
        inputSchema: {
          message_id: { type: "string", description: "ID del mensaje de Gmail", required: true },
        },
      },
    ];
  }

  async executeTool(toolKey: string, input: Record<string, unknown>, connection: HubConnection, context?: ToolContext): Promise<HubToolResult> {
    const start = Date.now();
    try {
      if (toolKey === "search_emails") {
        const token = await getToken(context, connection.id);
        const data  = await gmailApi.gmailSearchMessages(token, input.query as string, (input.limit as number) || 10);
        return { success: true, data, durationMs: Date.now() - start };
      }
      if (toolKey === "read_email") {
        const token = await getToken(context, connection.id);
        const data  = await gmailApi.gmailGetMessage(token, input.message_id as string);
        return { success: true, data, durationMs: Date.now() - start };
      }
      if (toolKey === "send_email") {
        const approval = requiresApproval(toolKey, context);
        if (approval) return approval;
        const token = await getToken(context, connection.id);
        const data  = await gmailApi.gmailSendMessage(token, {
          to:      input.to as string,
          subject: input.subject as string,
          body:    input.body as string,
          cc:      input.cc as string | undefined,
        });
        return { success: true, data, durationMs: Date.now() - start };
      }
      return { success: false, error: `Unknown tool: ${toolKey}`, durationMs: 0 };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Gmail error", durationMs: Date.now() - start };
    }
  }

  async healthCheck(connection: HubConnection, context?: ToolContext): Promise<ConnectionHealth> {
    if (connection.status !== "connected") {
      return { healthy: false, message: `Status: ${connection.status}`, checkedAt: new Date().toISOString() };
    }
    try {
      const token = await getToken(context, connection.id);
      await gmailApi.gmailSearchMessages(token, "is:inbox", 1);
      return { healthy: true, message: "Gmail connection is active.", checkedAt: new Date().toISOString() };
    } catch (err) {
      return { healthy: false, message: err instanceof Error ? err.message : "Health check failed", checkedAt: new Date().toISOString() };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async disconnect(_conn: HubConnection): Promise<void> {
    // token revocation best-effort handled by disconnect_integration_connection DB function
  }

  getAuthorizationUrl(): string {
    throw new Error("Use buildGoogleAuthUrl from google/oauth.ts");
  }
}

// ─── Google Calendar ──────────────────────────────────────────────────────────

export class RealGoogleCalendarProvider implements HubProvider {
  readonly key = "google_calendar";
  readonly name = "Google Calendar";
  readonly category = "productivity" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Crear y consultar eventos del calendario.";
  readonly iconEmoji = "📅";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "create_event",
        name: "Crear evento",
        description: "Crea un nuevo evento en Google Calendar. Requiere aprobación humana por defecto.",
        inputSchema: {
          title:       { type: "string", description: "Título del evento", required: true },
          start:       { type: "string", description: "Fecha y hora de inicio ISO 8601", required: true },
          end:         { type: "string", description: "Fecha y hora de fin ISO 8601", required: true },
          description: { type: "string", description: "Descripción del evento" },
          attendees:   { type: "array",  description: "Lista de emails de participantes" },
          location:    { type: "string", description: "Lugar del evento" },
        },
      },
      {
        key: "check_availability",
        name: "Consultar disponibilidad",
        description: "Verifica disponibilidad en un rango de tiempo.",
        inputSchema: {
          start: { type: "string", description: "Inicio del rango ISO 8601", required: true },
          end:   { type: "string", description: "Fin del rango ISO 8601", required: true },
        },
      },
      {
        key: "list_events",
        name: "Listar eventos",
        description: "Lista los próximos eventos del calendario.",
        inputSchema: {
          limit:     { type: "number", description: "Máximo de eventos (default 10)" },
          days_ahead: { type: "number", description: "Días hacia adelante (default 7)" },
        },
      },
    ];
  }

  async executeTool(toolKey: string, input: Record<string, unknown>, connection: HubConnection, context?: ToolContext): Promise<HubToolResult> {
    const start = Date.now();
    try {
      if (toolKey === "list_events") {
        const token = await getToken(context, connection.id);
        const data  = await calApi.calendarListEvents(token, {
          limit:     (input.limit as number) || 10,
          daysAhead: (input.days_ahead as number) || 7,
        });
        return { success: true, data, durationMs: Date.now() - start };
      }
      if (toolKey === "check_availability") {
        const token = await getToken(context, connection.id);
        const data  = await calApi.calendarCheckAvailability(token, {
          start: input.start as string,
          end:   input.end as string,
        });
        return { success: true, data, durationMs: Date.now() - start };
      }
      if (toolKey === "create_event") {
        const approval = requiresApproval(toolKey, context);
        if (approval) return approval;
        const token = await getToken(context, connection.id);
        const data  = await calApi.calendarCreateEvent(token, {
          title:       input.title as string,
          start:       input.start as string,
          end:         input.end as string,
          description: input.description as string | undefined,
          location:    input.location as string | undefined,
          attendees:   input.attendees as string[] | undefined,
        });
        return { success: true, data, durationMs: Date.now() - start };
      }
      return { success: false, error: `Unknown tool: ${toolKey}`, durationMs: 0 };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Calendar error", durationMs: Date.now() - start };
    }
  }

  async healthCheck(connection: HubConnection, context?: ToolContext): Promise<ConnectionHealth> {
    if (connection.status !== "connected") {
      return { healthy: false, message: `Status: ${connection.status}`, checkedAt: new Date().toISOString() };
    }
    try {
      const token = await getToken(context, connection.id);
      await calApi.calendarListEvents(token, { limit: 1, daysAhead: 1 });
      return { healthy: true, message: "Google Calendar connection is active.", checkedAt: new Date().toISOString() };
    } catch (err) {
      return { healthy: false, message: err instanceof Error ? err.message : "Health check failed", checkedAt: new Date().toISOString() };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async disconnect(_conn: HubConnection): Promise<void> {}
}

// ─── Google Sheets ────────────────────────────────────────────────────────────

export class RealGoogleSheetsProvider implements HubProvider {
  readonly key = "google_sheets";
  readonly name = "Google Sheets";
  readonly category = "productivity" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Leer y escribir filas en hojas de cálculo.";
  readonly iconEmoji = "📊";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "read_rows",
        name: "Leer filas",
        description: "Lee filas de una hoja de cálculo.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID del spreadsheet", required: true },
          sheet_name:     { type: "string", description: "Nombre de la hoja" },
          range:          { type: "string", description: "Rango A1 (ej: A1:D10)" },
        },
      },
      {
        key: "append_row",
        name: "Agregar fila",
        description: "Agrega una nueva fila al final de la hoja. Requiere aprobación por defecto.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID del spreadsheet", required: true },
          sheet_name:     { type: "string", description: "Nombre de la hoja" },
          values:         { type: "array",  description: "Valores de la fila", required: true },
        },
      },
      {
        key: "search_rows",
        name: "Buscar filas",
        description: "Busca filas por texto en la hoja.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID del spreadsheet", required: true },
          query:          { type: "string", description: "Texto a buscar", required: true },
          sheet_name:     { type: "string", description: "Nombre de la hoja" },
        },
      },
      {
        key: "update_row",
        name: "Actualizar fila",
        description: "Actualiza una fila existente. Requiere aprobación por defecto.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID del spreadsheet", required: true },
          row_index:      { type: "number", description: "Índice de la fila (1-based)", required: true },
          values:         { type: "array",  description: "Nuevos valores", required: true },
          sheet_name:     { type: "string", description: "Nombre de la hoja" },
        },
      },
    ];
  }

  async executeTool(toolKey: string, input: Record<string, unknown>, connection: HubConnection, context?: ToolContext): Promise<HubToolResult> {
    const start = Date.now();
    try {
      const id = input.spreadsheet_id as string;
      const sheet = input.sheet_name as string | undefined;

      if (toolKey === "read_rows") {
        const token = await getToken(context, connection.id);
        const data  = await sheetsApi.sheetsReadRange(token, id, input.range as string | undefined, sheet);
        return { success: true, data, durationMs: Date.now() - start };
      }
      if (toolKey === "search_rows") {
        const token = await getToken(context, connection.id);
        const data  = await sheetsApi.sheetsSearchRows(token, id, input.query as string, sheet);
        return { success: true, data, durationMs: Date.now() - start };
      }
      if (toolKey === "append_row") {
        const approval = requiresApproval(toolKey, context);
        if (approval) return approval;
        const token = await getToken(context, connection.id);
        await sheetsApi.sheetsAppendRow(token, id, input.values as unknown[], sheet);
        return { success: true, data: { appended: true }, durationMs: Date.now() - start };
      }
      if (toolKey === "update_row") {
        const approval = requiresApproval(toolKey, context);
        if (approval) return approval;
        const token = await getToken(context, connection.id);
        await sheetsApi.sheetsUpdateRow(token, id, input.row_index as number, input.values as unknown[], sheet);
        return { success: true, data: { updated: true }, durationMs: Date.now() - start };
      }
      return { success: false, error: `Unknown tool: ${toolKey}`, durationMs: 0 };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Sheets error", durationMs: Date.now() - start };
    }
  }

  async healthCheck(connection: HubConnection, context?: ToolContext): Promise<ConnectionHealth> {
    if (connection.status !== "connected") {
      return { healthy: false, message: `Status: ${connection.status}`, checkedAt: new Date().toISOString() };
    }
    try {
      await getToken(context, connection.id);
      return { healthy: true, message: "Google Sheets connection is active.", checkedAt: new Date().toISOString() };
    } catch (err) {
      return { healthy: false, message: err instanceof Error ? err.message : "Health check failed", checkedAt: new Date().toISOString() };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async disconnect(_conn: HubConnection): Promise<void> {}
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

export class RealGoogleDriveProvider implements HubProvider {
  readonly key = "google_drive";
  readonly name = "Google Drive";
  readonly category = "storage" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Listar y obtener URLs de archivos en Drive.";
  readonly iconEmoji = "💾";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "list_files",
        name: "Listar archivos",
        description: "Lista archivos y carpetas en Drive.",
        inputSchema: {
          folder_id: { type: "string", description: "ID de carpeta (por defecto: raíz)" },
          query:     { type: "string", description: "Filtro de nombre" },
          limit:     { type: "number", description: "Máximo de archivos" },
        },
      },
      {
        key: "get_file_url",
        name: "Obtener URL de archivo",
        description: "Obtiene la URL de visualización/descarga de un archivo.",
        inputSchema: {
          file_id: { type: "string", description: "ID del archivo en Drive", required: true },
        },
      },
    ];
  }

  async executeTool(toolKey: string, input: Record<string, unknown>, connection: HubConnection, context?: ToolContext): Promise<HubToolResult> {
    const start = Date.now();
    try {
      if (toolKey === "list_files") {
        const token = await getToken(context, connection.id);
        const data  = await driveApi.driveListFiles(token, {
          folderId: input.folder_id as string | undefined,
          query:    input.query as string | undefined,
          limit:    (input.limit as number) || 20,
        });
        return { success: true, data, durationMs: Date.now() - start };
      }
      if (toolKey === "get_file_url") {
        const token = await getToken(context, connection.id);
        const data  = await driveApi.driveGetFileUrl(token, input.file_id as string);
        return { success: true, data, durationMs: Date.now() - start };
      }
      return { success: false, error: `Unknown tool: ${toolKey}`, durationMs: 0 };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Drive error", durationMs: Date.now() - start };
    }
  }

  async healthCheck(connection: HubConnection, context?: ToolContext): Promise<ConnectionHealth> {
    if (connection.status !== "connected") {
      return { healthy: false, message: `Status: ${connection.status}`, checkedAt: new Date().toISOString() };
    }
    try {
      const token = await getToken(context, connection.id);
      await driveApi.driveListFiles(token, { limit: 1 });
      return { healthy: true, message: "Google Drive connection is active.", checkedAt: new Date().toISOString() };
    } catch (err) {
      return { healthy: false, message: err instanceof Error ? err.message : "Health check failed", checkedAt: new Date().toISOString() };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async disconnect(_conn: HubConnection): Promise<void> {}
}
