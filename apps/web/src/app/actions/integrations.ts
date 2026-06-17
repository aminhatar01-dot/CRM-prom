"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  customConnectToolSchema,
  googleSheetsConnectionSchema
} from "@crm-pro-ai/integrations/tools";
import { requireUser } from "@/lib/auth";
import { runIntegrationTool } from "@/lib/integrations/executor";
import { getActiveOrganization } from "@/lib/organization";

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function parseJsonRecord(raw: string) {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function safeJsonRecord(raw: string) {
  try {
    return parseJsonRecord(raw);
  } catch {
    return null;
  }
}

export async function createCustomConnect(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const parsed = customConnectToolSchema.safeParse({
    organization_id: organization.id,
    name: value(formData, "name"),
    description: value(formData, "description") || null,
    method: value(formData, "method"),
    url: value(formData, "url"),
    headers_schema: safeJsonRecord(value(formData, "headers_schema")),
    body_schema: safeJsonRecord(value(formData, "body_schema")),
    response_schema: safeJsonRecord(value(formData, "response_schema")),
    active: formData.get("active") === "on",
    timeout_ms: value(formData, "timeout_ms") || 8000,
    config: {}
  });

  if (!parsed.success) redirect("/integrations/new?error=invalid");

  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      description: parsed.data.description,
      kind: "custom_connect",
      active: parsed.data.active,
      config: {}
    })
    .select("id")
    .single<{ id: string }>();

  if (integrationError || !integration) redirect("/integrations/new?error=create");

  const { data: tool, error: toolError } = await supabase
    .from("integration_tools")
    .insert({
      ...parsed.data,
      integration_id: integration.id
    })
    .select("id")
    .single<{ id: string }>();

  if (toolError || !tool) redirect("/integrations/new?error=tool");

  await audit("create_custom_connect", "integrations", integration.id, organization.id);
  revalidatePath("/integrations");
  redirect(`/integrations/${integration.id}`);
}

export async function updateCustomConnect(formData: FormData) {
  const id = value(formData, "id");
  const integrationId = value(formData, "integration_id");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const parsed = customConnectToolSchema.safeParse({
    organization_id: organization.id,
    integration_id: integrationId,
    name: value(formData, "name"),
    description: value(formData, "description") || null,
    method: value(formData, "method"),
    url: value(formData, "url"),
    headers_schema: safeJsonRecord(value(formData, "headers_schema")),
    body_schema: safeJsonRecord(value(formData, "body_schema")),
    response_schema: safeJsonRecord(value(formData, "response_schema")),
    active: formData.get("active") === "on",
    timeout_ms: value(formData, "timeout_ms") || 8000,
    config: {}
  });

  if (!parsed.success) redirect(`/integrations/${integrationId}/edit?error=invalid`);

  await supabase
    .from("integrations")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      active: parsed.data.active
    })
    .eq("id", integrationId)
    .eq("organization_id", organization.id);

  const { error } = await supabase
    .from("integration_tools")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) redirect(`/integrations/${integrationId}/edit?error=update`);

  await audit("update_custom_connect", "integrations", integrationId, organization.id);
  revalidatePath("/integrations");
  revalidatePath(`/integrations/${integrationId}`);
  redirect(`/integrations/${integrationId}`);
}

export async function setupGoogleSheets(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const parsed = googleSheetsConnectionSchema.safeParse({
    organization_id: organization.id,
    name: value(formData, "name"),
    description: value(formData, "description") || null,
    spreadsheet_url: value(formData, "spreadsheet_url"),
    sheet_name: value(formData, "sheet_name") || null,
    api_key_ref: value(formData, "api_key_ref") || null,
    active: formData.get("active") === "on"
  });

  if (!parsed.success) redirect("/integrations/google-sheets?error=invalid");

  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      description: parsed.data.description,
      kind: "google_sheets",
      active: parsed.data.active,
      credentials_ref: parsed.data.api_key_ref,
      config: { spreadsheet_url: parsed.data.spreadsheet_url, sheet_name: parsed.data.sheet_name }
    })
    .select("id")
    .single<{ id: string }>();

  if (integrationError || !integration) redirect("/integrations/google-sheets?error=create");

  const { data: tool } = await supabase
    .from("integration_tools")
    .insert({
      organization_id: organization.id,
      integration_id: integration.id,
      name: `${parsed.data.name} search`,
      description: "Busca filas por texto en una hoja publica.",
      type: "google_sheets",
      active: parsed.data.active,
      config: {
        spreadsheet_url: parsed.data.spreadsheet_url,
        sheet_name: parsed.data.sheet_name
      }
    })
    .select("id")
    .single<{ id: string }>();

  await supabase.from("google_sheets_connections").insert({
    organization_id: organization.id,
    integration_id: integration.id,
    spreadsheet_url: parsed.data.spreadsheet_url,
    sheet_name: parsed.data.sheet_name,
    api_key_ref: parsed.data.api_key_ref,
    active: parsed.data.active
  });

  await audit("setup_google_sheets", "integrations", integration.id, organization.id);
  revalidatePath("/integrations");
  redirect(`/integrations/${integration.id}?tool=${tool?.id ?? ""}`);
}

export async function testIntegrationTool(formData: FormData) {
  const toolId = value(formData, "tool_id");
  const integrationId = value(formData, "integration_id");
  const input = safeJsonRecord(value(formData, "input")) ?? {};
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const result = await runIntegrationTool({
    supabase,
    organizationId: organization.id,
    toolId,
    userId: user.id,
    input
  });

  revalidatePath(`/integrations/${integrationId}`);
  redirect(`/integrations/${integrationId}?run=${result.runId ?? ""}&status=${result.status}`);
}

async function audit(
  action: string,
  entityTable: string,
  entityId: string | undefined,
  organizationId: string,
  metadata: Record<string, unknown> = {},
) {
  const { supabase, user } = await requireUser();
  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: user.id,
    action,
    entity_table: entityTable,
    entity_id: entityId,
    metadata
  });
}
