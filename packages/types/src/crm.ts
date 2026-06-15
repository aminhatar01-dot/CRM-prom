export type LeadStatus =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "propuesta"
  | "ganado"
  | "perdido";
export type ConversationChannel = "whatsapp" | "webchat" | "manual";
export type ConversationStatus = "abierta" | "pendiente" | "cerrada";
export type ConversationAiStatus = "active" | "paused" | "human";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type WhatsAppMessageType = "text" | "image" | "audio" | "document" | "location";

export type TenantEntity = {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};
