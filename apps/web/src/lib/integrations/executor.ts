import { ToolExecutor, type ExecutableTool } from "@crm-pro-ai/integrations/tool-executor";
import { checkDistributedRateLimit } from "../rate-limit/distributed";
import type { requireUser } from "@/lib/auth";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["supabase"];

type ToolRow = ExecutableTool & {
  integrations: { id: string; active: boolean } | null;
};

export async function runIntegrationTool({
  supabase,
  organizationId,
  toolId,
  userId,
  input
}: {
  supabase: SupabaseClient;
  organizationId: string;
  toolId: string;
  userId: string;
  input: Record<string, unknown>;
}) {
  const allowed = await checkDistributedRateLimit(supabase, organizationId, "integration_tools");
  if (!allowed) {
    return { status: "failed" as const, error: "Rate limit exceeded", runId: undefined };
  }

  const { data: tool } = await supabase
    .from("integration_tools")
    .select("id, organization_id, integration_id, name, type, method, url, headers_schema, body_schema, response_schema, timeout_ms, config, integrations(id, active)")
    .eq("id", toolId)
    .eq("organization_id", organizationId)
    .single<ToolRow>();

  if (!tool || !tool.integrations?.active) {
    return { status: "failed" as const, error: "Tool not found or inactive integration", runId: undefined };
  }

  const { data: run } = await supabase
    .from("integration_tool_runs")
    .insert({
      organization_id: organizationId,
      integration_id: tool.integration_id,
      tool_id: tool.id,
      status: "running",
      input,
      executed_by: userId
    })
    .select("id")
    .single<{ id: string }>();

  const executor = new ToolExecutor();
  const result = await executor.execute(tool, organizationId, input);

  if (run?.id) {
    await supabase
      .from("integration_tool_runs")
      .update({
        status: result.status,
        output: result.output ?? null,
        error_message: result.error ?? null,
        duration_ms: result.duration_ms
      })
      .eq("id", run.id)
      .eq("organization_id", organizationId)
      .select("id")
      .single<{ id: string }>();
  }

  return { ...result, runId: run?.id };
}
