import type {
  HubProvider,
  HubConnection,
  HubToolDefinition,
  HubToolResult,
  ConnectionHealth,
  ProviderMetadata,
  ToolContext,
} from "./hub-provider";
import { HubNotImplementedError } from "./hub-provider";
import {
  RealGmailProvider,
  RealGoogleCalendarProvider,
  RealGoogleSheetsProvider,
  RealGoogleDriveProvider,
} from "./google/providers";

// ─── Base stub class ──────────────────────────────────────────────────────────

abstract class BaseHubProvider implements HubProvider {
  abstract readonly key: string;
  abstract readonly name: string;
  abstract readonly category: HubProvider["category"];
  abstract readonly authType: HubProvider["authType"];
  abstract readonly description: string;
  abstract readonly iconEmoji: string;
  abstract getToolDefinitions(): HubToolDefinition[];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async executeTool(toolKey: string, _input: Record<string, unknown>, connection: HubConnection, _ctx?: ToolContext): Promise<HubToolResult> {
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
  new RealGoogleCalendarProvider(),
  new RealGmailProvider(),
  new RealGoogleSheetsProvider(),
  new RealGoogleDriveProvider(),
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
