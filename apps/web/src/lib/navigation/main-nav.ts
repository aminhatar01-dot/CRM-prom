import {
  Bot,
  BookOpen,
  FileText,
  Braces,
  Columns3,
  LayoutDashboard,
  MessageSquareText,
  Plug,
  Settings,
  Sparkles,
  Tags,
  UsersRound,
  Workflow
} from "lucide-react";
import { canManageSettings } from "../permissions/roles";

export const mainNavigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/leads", label: "Leads", icon: UsersRound, adminOnly: false },
  { href: "/pipeline", label: "Pipeline", icon: Columns3, adminOnly: false },
  { href: "/contacts", label: "Contactos", icon: UsersRound, adminOnly: false },
  { href: "/inbox", label: "Inbox", icon: MessageSquareText, adminOnly: false },
  { href: "/quotes", label: "Cotizaciones", icon: FileText, adminOnly: false },
  { href: "/assistants", label: "Asistentes", icon: Sparkles, adminOnly: true },
  { href: "/smart-tags", label: "Smart Tags", icon: Tags, adminOnly: true },
  { href: "/variables", label: "Variables", icon: Braces, adminOnly: true },
  { href: "/knowledge", label: "Base de conocimiento", icon: BookOpen, adminOnly: true },
  { href: "/automations", label: "Automatizaciones", icon: Workflow, adminOnly: true },
  { href: "/integrations", label: "Integraciones", icon: Plug, adminOnly: true },
  { href: "/settings/channels/webchat", label: "WebChat", icon: MessageSquareText, adminOnly: true },
  { href: "/settings/channels/whatsapp", label: "WhatsApp", icon: Settings, adminOnly: true },
  { href: "/settings/setup", label: "Configuracion", icon: Settings, adminOnly: true },
  { href: "/settings/system-status", label: "System Status", icon: Bot, adminOnly: true }
] as const;

export function navigationForRole(role: string) {
  return mainNavigationItems.filter((item) => !item.adminOnly || canManageSettings(role));
}
