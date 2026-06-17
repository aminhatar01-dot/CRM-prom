import { availableToolSummary, type AvailableTool } from "@crm-pro-ai/integrations/tools";
import type { requireUser } from "@/lib/auth";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["supabase"];

type ToolRow = {
  id: string;
  name: string;
  description: string | null;
  type: "custom_connect" | "google_sheets";
  body_schema: Record<string, unknown>;
  config: Record<string, unknown>;
};

export async function loadAvailableAITools(supabase: SupabaseClient, organizationId: string) {
  const { data } = await supabase
    .from("integration_tools")
    .select("id, name, description, type, body_schema, config")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name")
    .returns<ToolRow[]>();

  const tools: AvailableTool[] = (data ?? []).map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    type: tool.type,
    input_schema: tool.type === "google_sheets" ? { query: "string" } : tool.body_schema
  }));

  return availableToolSummary(tools);
}
