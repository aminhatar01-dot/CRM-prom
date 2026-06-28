import type {
  HubProvider,
  HubConnection,
  HubToolDefinition,
  HubToolResult,
  ConnectionHealth,
  ProviderMetadata,
} from "./hub-provider";
import { HubNotImplementedError } from "./hub-provider";

// ─── Base stub class ──────────────────────────────────────────────────────────

abstract class BaseHubProvider implements HubProvider {
  abstract readonly key: string;
  abstract readonly name: string;
  abstract readonly category: HubProvider["category"];
  abstract readonly authType: HubProvider["authType"];
  abstract readonly description: string;
  abstract readonly iconEmoji: string;
  abstract getToolDefinitions(): HubToolDefinition[];

  async executeTool(toolKey: string, _input: Record<string, unknown>, connection: HubConnection): Promise<HubToolResult> {
    const defs = this.getToolDefinitions();
    if (!defs.find((d) => d.key === toolKey)) {
      return { success: false, error: `Tool "${toolKey}" not found in provider "${this.key}".`, durationMs: 0 };
    }
    if (connection.status !== "connected") {
      return { success: false, error: `Connection "${connection.displayName}" is not active (status: ${connection.status}).`, durationMs: 0 };
    }
    throw new HubNotImplementedError(this.key, toolKey);
  }

  async healthCheck(connection: HubConnection): Promise<ConnectionHealth> {
    return {
      healthy: connection.status === "connected",
      message: connection.status === "connected" ? "Connection is active." : `Status: ${connection.status}.`,
      checkedAt: new Date().toISOString()
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async disconnect(_conn: HubConnection): Promise<void> {
    // token revocation is handled by the DB function disconnect_integration_connection
    // provider-specific revocation implemented per-provider in Phase 29
  }
}

// ─── Google provider ──────────────────────────────────────────────────────────

class GoogleCalendarProvider extends BaseHubProvider {
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
        description: "Crea un nuevo evento en Google Calendar.",
        inputSchema: {
          title: { type: "string", description: "Titulo del evento", required: true },
          start: { type: "string", description: "Fecha y hora de inicio ISO 8601", required: true },
          end: { type: "string", description: "Fecha y hora de fin ISO 8601", required: true },
          description: { type: "string", description: "Descripcion del evento" },
          attendees: { type: "array", description: "Lista de emails de participantes" },
          location: { type: "string", description: "Lugar del evento" }
        }
      },
      {
        key: "check_availability",
        name: "Consultar disponibilidad",
        description: "Verifica disponibilidad en un rango de tiempo.",
        inputSchema: {
          start: { type: "string", description: "Inicio del rango ISO 8601", required: true },
          end: { type: "string", description: "Fin del rango ISO 8601", required: true }
        }
      },
      {
        key: "list_events",
        name: "Listar eventos",
        description: "Lista los proximos eventos del calendario.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de eventos a devolver (default 10)" },
          days_ahead: { type: "number", description: "Dias hacia adelante a consultar (default 7)" }
        }
      }
    ];
  }
}

class GmailProvider extends BaseHubProvider {
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
        description: "Envia un correo electronico desde la cuenta conectada.",
        inputSchema: {
          to: { type: "string", description: "Email del destinatario", required: true },
          subject: { type: "string", description: "Asunto del correo", required: true },
          body: { type: "string", description: "Cuerpo del mensaje (texto o HTML)", required: true },
          cc: { type: "string", description: "Email en copia" }
        }
      },
      {
        key: "search_emails",
        name: "Buscar emails",
        description: "Busca correos por termino o filtro.",
        inputSchema: {
          query: { type: "string", description: "Termino de busqueda (Gmail query syntax)", required: true },
          limit: { type: "number", description: "Maximo de resultados" }
        }
      },
      {
        key: "read_email",
        name: "Leer email",
        description: "Lee el contenido de un email especifico.",
        inputSchema: {
          message_id: { type: "string", description: "ID del mensaje de Gmail", required: true }
        }
      }
    ];
  }
}

class GoogleSheetsHubProvider extends BaseHubProvider {
  readonly key = "google_sheets";
  readonly name = "Google Sheets";
  readonly category = "productivity" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Leer y escribir filas en hojas de calculo.";
  readonly iconEmoji = "📊";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "read_rows",
        name: "Leer filas",
        description: "Lee filas de una hoja de calculo.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID o URL del spreadsheet", required: true },
          sheet_name: { type: "string", description: "Nombre de la hoja" },
          range: { type: "string", description: "Rango A1 (ej: A1:D10)" }
        }
      },
      {
        key: "append_row",
        name: "Agregar fila",
        description: "Agrega una nueva fila al final de la hoja.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID o URL del spreadsheet", required: true },
          sheet_name: { type: "string", description: "Nombre de la hoja" },
          values: { type: "array", description: "Valores de la fila a agregar", required: true }
        }
      },
      {
        key: "search_rows",
        name: "Buscar filas",
        description: "Busca filas por texto en una hoja.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID o URL del spreadsheet", required: true },
          query: { type: "string", description: "Texto a buscar en la hoja", required: true },
          sheet_name: { type: "string", description: "Nombre de la hoja" }
        }
      },
      {
        key: "update_row",
        name: "Actualizar fila",
        description: "Actualiza una fila existente en la hoja.",
        inputSchema: {
          spreadsheet_id: { type: "string", description: "ID o URL del spreadsheet", required: true },
          row_index: { type: "number", description: "Indice de la fila (1-based)", required: true },
          values: { type: "array", description: "Nuevos valores de la fila", required: true }
        }
      }
    ];
  }
}

class GoogleDriveProvider extends BaseHubProvider {
  readonly key = "google_drive";
  readonly name = "Google Drive";
  readonly category = "storage" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Listar, subir y compartir archivos en Drive.";
  readonly iconEmoji = "💾";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "list_files",
        name: "Listar archivos",
        description: "Lista archivos y carpetas en Drive.",
        inputSchema: {
          folder_id: { type: "string", description: "ID de la carpeta (opcional, por defecto raiz)" },
          query: { type: "string", description: "Filtro de busqueda" },
          limit: { type: "number", description: "Maximo de archivos" }
        }
      },
      {
        key: "get_file_url",
        name: "Obtener URL de archivo",
        description: "Obtiene la URL de descarga/visualizacion de un archivo.",
        inputSchema: {
          file_id: { type: "string", description: "ID del archivo en Drive", required: true }
        }
      }
    ];
  }
}

// ─── Meta providers ───────────────────────────────────────────────────────────

class InstagramProvider extends BaseHubProvider {
  readonly key = "instagram";
  readonly name = "Instagram Business";
  readonly category = "social" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Mensajes directos e interaccion con publicaciones.";
  readonly iconEmoji = "📸";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "send_dm",
        name: "Enviar mensaje directo",
        description: "Envia un mensaje directo a un usuario de Instagram.",
        inputSchema: {
          recipient_id: { type: "string", description: "ID del destinatario de Instagram", required: true },
          message: { type: "string", description: "Texto del mensaje", required: true }
        }
      },
      {
        key: "get_dms",
        name: "Obtener mensajes directos",
        description: "Lista los mensajes directos recientes.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de mensajes" }
        }
      },
      {
        key: "reply_comment",
        name: "Responder comentario",
        description: "Responde a un comentario en una publicacion.",
        inputSchema: {
          comment_id: { type: "string", description: "ID del comentario", required: true },
          message: { type: "string", description: "Respuesta al comentario", required: true }
        }
      },
      {
        key: "get_media",
        name: "Obtener publicaciones",
        description: "Lista las publicaciones recientes de la cuenta.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de publicaciones" }
        }
      }
    ];
  }
}

class FacebookProvider extends BaseHubProvider {
  readonly key = "facebook";
  readonly name = "Facebook Pages";
  readonly category = "social" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Publicaciones, comentarios y mensajes de Paginas.";
  readonly iconEmoji = "📘";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "send_page_message",
        name: "Enviar mensaje de pagina",
        description: "Envia un mensaje desde la Pagina de Facebook.",
        inputSchema: {
          recipient_id: { type: "string", description: "ID del destinatario", required: true },
          message: { type: "string", description: "Texto del mensaje", required: true }
        }
      },
      {
        key: "get_page_posts",
        name: "Obtener publicaciones",
        description: "Lista las publicaciones recientes de la Pagina.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de publicaciones" }
        }
      },
      {
        key: "reply_comment",
        name: "Responder comentario",
        description: "Responde a un comentario en una publicacion.",
        inputSchema: {
          comment_id: { type: "string", description: "ID del comentario", required: true },
          message: { type: "string", description: "Respuesta", required: true }
        }
      }
    ];
  }
}

class MessengerProvider extends BaseHubProvider {
  readonly key = "messenger";
  readonly name = "Facebook Messenger";
  readonly category = "messaging" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Mensajeria via Messenger de Facebook.";
  readonly iconEmoji = "💬";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "send_message",
        name: "Enviar mensaje",
        description: "Envia un mensaje por Messenger.",
        inputSchema: {
          recipient_id: { type: "string", description: "ID del destinatario", required: true },
          message: { type: "string", description: "Texto del mensaje", required: true }
        }
      },
      {
        key: "get_conversations",
        name: "Obtener conversaciones",
        description: "Lista las conversaciones recientes en Messenger.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de conversaciones" }
        }
      }
    ];
  }
}

class MetaAdsProvider extends BaseHubProvider {
  readonly key = "meta_ads";
  readonly name = "Meta Ads";
  readonly category = "advertising" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Leer campanas, grupos de anuncios y metricas.";
  readonly iconEmoji = "📢";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_campaigns",
        name: "Obtener campanas",
        description: "Lista las campanas publicitarias de la cuenta.",
        inputSchema: {
          status: { type: "string", description: "Filtrar por estado (ACTIVE, PAUSED, ALL)", enum: ["ACTIVE", "PAUSED", "ALL"] },
          limit: { type: "number", description: "Maximo de campanas" }
        }
      },
      {
        key: "get_campaign_insights",
        name: "Obtener metricas de campana",
        description: "Lee impresiones, clics, gasto y conversiones de una campana.",
        inputSchema: {
          campaign_id: { type: "string", description: "ID de la campana", required: true },
          date_range: { type: "string", description: "Rango de fechas (last_7d, last_30d, this_month)", enum: ["last_7d", "last_30d", "this_month"] }
        }
      }
    ];
  }
}

// ─── TikTok provider ──────────────────────────────────────────────────────────

class TikTokProvider extends BaseHubProvider {
  readonly key = "tiktok";
  readonly name = "TikTok Business";
  readonly category = "social" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Comentarios, videos y mensajes de TikTok Business.";
  readonly iconEmoji = "🎵";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_videos",
        name: "Obtener videos",
        description: "Lista los videos recientes de la cuenta de TikTok.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de videos" }
        }
      },
      {
        key: "reply_comment",
        name: "Responder comentario",
        description: "Responde a un comentario en un video de TikTok.",
        inputSchema: {
          comment_id: { type: "string", description: "ID del comentario", required: true },
          message: { type: "string", description: "Respuesta al comentario", required: true }
        }
      }
    ];
  }
}

// ─── Ecommerce providers ──────────────────────────────────────────────────────

class MercadoLibreProvider extends BaseHubProvider {
  readonly key = "mercadolibre";
  readonly name = "Mercado Libre";
  readonly category = "ecommerce" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Publicaciones, preguntas, ordenes y stock.";
  readonly iconEmoji = "🛒";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_listings",
        name: "Obtener publicaciones",
        description: "Lista las publicaciones activas en Mercado Libre.",
        inputSchema: {
          status: { type: "string", description: "Estado de las publicaciones (active, paused, closed)" },
          limit: { type: "number", description: "Maximo de publicaciones" }
        }
      },
      {
        key: "get_questions",
        name: "Obtener preguntas",
        description: "Lista las preguntas sin responder de los compradores.",
        inputSchema: {
          item_id: { type: "string", description: "ID del articulo (opcional, devuelve todas si se omite)" },
          status: { type: "string", description: "Estado de la pregunta (unanswered, answered)", enum: ["unanswered", "answered", "all"] }
        }
      },
      {
        key: "answer_question",
        name: "Responder pregunta",
        description: "Responde una pregunta de un comprador.",
        inputSchema: {
          question_id: { type: "string", description: "ID de la pregunta", required: true },
          answer: { type: "string", description: "Texto de la respuesta", required: true }
        }
      },
      {
        key: "get_orders",
        name: "Obtener ordenes",
        description: "Lista las ordenes recientes del vendedor.",
        inputSchema: {
          status: { type: "string", description: "Estado de la orden (paid, pending, cancelled)" },
          limit: { type: "number", description: "Maximo de ordenes" }
        }
      },
      {
        key: "get_stock",
        name: "Consultar stock",
        description: "Consulta el stock disponible de un articulo.",
        inputSchema: {
          item_id: { type: "string", description: "ID del articulo en Mercado Libre", required: true }
        }
      }
    ];
  }
}

class TiendanubeProvider extends BaseHubProvider {
  readonly key = "tiendanube";
  readonly name = "Tiendanube";
  readonly category = "ecommerce" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Productos, pedidos y clientes de Tiendanube.";
  readonly iconEmoji = "🏪";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_products",
        name: "Obtener productos",
        description: "Lista los productos de la tienda.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de productos" },
          query: { type: "string", description: "Filtrar por nombre o SKU" }
        }
      },
      {
        key: "get_orders",
        name: "Obtener pedidos",
        description: "Lista los pedidos recientes de la tienda.",
        inputSchema: {
          status: { type: "string", description: "Estado del pedido" },
          limit: { type: "number", description: "Maximo de pedidos" }
        }
      },
      {
        key: "get_order",
        name: "Obtener pedido",
        description: "Obtiene los detalles de un pedido especifico.",
        inputSchema: {
          order_id: { type: "string", description: "ID del pedido en Tiendanube", required: true }
        }
      }
    ];
  }
}

class ShopifyProvider extends BaseHubProvider {
  readonly key = "shopify";
  readonly name = "Shopify";
  readonly category = "ecommerce" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Productos, pedidos y clientes de Shopify.";
  readonly iconEmoji = "🛍️";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_products",
        name: "Obtener productos",
        description: "Lista los productos de la tienda Shopify.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de productos (default 50)" },
          status: { type: "string", description: "Estado del producto (active, draft, archived)", enum: ["active", "draft", "archived"] }
        }
      },
      {
        key: "get_orders",
        name: "Obtener pedidos",
        description: "Lista los pedidos recientes de la tienda.",
        inputSchema: {
          status: { type: "string", description: "Estado del pedido", enum: ["open", "closed", "cancelled", "any"] },
          limit: { type: "number", description: "Maximo de pedidos" }
        }
      },
      {
        key: "get_customer",
        name: "Buscar cliente",
        description: "Busca un cliente por email o telefono.",
        inputSchema: {
          query: { type: "string", description: "Email, telefono o nombre del cliente", required: true }
        }
      },
      {
        key: "get_inventory",
        name: "Consultar inventario",
        description: "Consulta el stock de un producto.",
        inputSchema: {
          product_id: { type: "string", description: "ID del producto en Shopify", required: true }
        }
      }
    ];
  }
}

class WooCommerceProvider extends BaseHubProvider {
  readonly key = "woocommerce";
  readonly name = "WooCommerce";
  readonly category = "ecommerce" as const;
  readonly authType = "api_key" as const;
  readonly description = "Productos, pedidos y clientes via REST API.";
  readonly iconEmoji = "🛒";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_products",
        name: "Obtener productos",
        description: "Lista los productos de la tienda WooCommerce.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de productos" },
          search: { type: "string", description: "Filtrar por nombre o SKU" }
        }
      },
      {
        key: "get_orders",
        name: "Obtener pedidos",
        description: "Lista los pedidos recientes.",
        inputSchema: {
          status: { type: "string", description: "Estado del pedido (pending, processing, completed, refunded)" },
          limit: { type: "number", description: "Maximo de pedidos" }
        }
      }
    ];
  }
}

class GoogleAdsProvider extends BaseHubProvider {
  readonly key = "google_ads";
  readonly name = "Google Ads";
  readonly category = "advertising" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Leer campanas, grupos de anuncios y metricas.";
  readonly iconEmoji = "📣";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_campaigns",
        name: "Obtener campanas",
        description: "Lista las campanas de Google Ads.",
        inputSchema: {
          status: { type: "string", description: "Estado de las campanas (ENABLED, PAUSED, ALL)", enum: ["ENABLED", "PAUSED", "ALL"] },
          limit: { type: "number", description: "Maximo de campanas" }
        }
      },
      {
        key: "get_campaign_metrics",
        name: "Obtener metricas",
        description: "Lee impresiones, clics, costo y conversiones de una campana.",
        inputSchema: {
          campaign_id: { type: "string", description: "ID de la campana en Google Ads", required: true },
          date_range: { type: "string", description: "Rango de fechas (LAST_7_DAYS, LAST_30_DAYS, THIS_MONTH)", enum: ["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH"] }
        }
      }
    ];
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const ALL_PROVIDERS: HubProvider[] = [
  new GoogleCalendarProvider(),
  new GmailProvider(),
  new GoogleSheetsHubProvider(),
  new GoogleDriveProvider(),
  new InstagramProvider(),
  new FacebookProvider(),
  new MessengerProvider(),
  new MetaAdsProvider(),
  new TikTokProvider(),
  new MercadoLibreProvider(),
  new TiendanubeProvider(),
  new ShopifyProvider(),
  new WooCommerceProvider(),
  new GoogleAdsProvider(),
];

const REGISTRY = new Map<string, HubProvider>(
  ALL_PROVIDERS.map((p) => [p.key, p])
);

export function getProvider(key: string): HubProvider | undefined {
  return REGISTRY.get(key);
}

export function getProviderOrThrow(key: string): HubProvider {
  const provider = REGISTRY.get(key);
  if (!provider) throw new Error(`Integration provider "${key}" is not registered.`);
  return provider;
}

export function getAllProviders(): HubProvider[] {
  return ALL_PROVIDERS;
}

export function getAllProviderMetadata(): ProviderMetadata[] {
  return ALL_PROVIDERS.map((p) => ({
    key: p.key,
    name: p.name,
    category: p.category,
    authType: p.authType,
    description: p.description,
    iconEmoji: p.iconEmoji,
    toolCount: p.getToolDefinitions().length
  }));
}

export function getProvidersByCategory(): Record<string, ProviderMetadata[]> {
  const result: Record<string, ProviderMetadata[]> = {};
  for (const meta of getAllProviderMetadata()) {
    (result[meta.category] ??= []).push(meta);
  }
  return result;
}
