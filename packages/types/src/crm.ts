export type LeadStatus = "new" | "qualified" | "won" | "lost";
export type ConversationChannel = "whatsapp" | "webchat";
export type MessageDirection = "inbound" | "outbound";

export type TenantEntity = {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};
