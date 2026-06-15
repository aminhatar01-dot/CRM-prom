"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { VariableExtractor } from "@crm-pro-ai/ai/variable-extractor";
import { variableSchema, variableUpdateSchema } from "@crm-pro-ai/ai/variables";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import {
  buildConversationVariableContext,
  buildLeadVariableContext,
  mapVariable,
  type VariableRow
} from "@/lib/ai/variable-context";

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function variablePayload(formData: FormData) {
  return {
    name: value(formData, "name"),
    key: value(formData, "key"),
    description: value(formData, "description") || null,
    type: value(formData, "type"),
    extraction_prompt: value(formData, "extraction_prompt"),
    active: formData.get("active") === "on",
    required: formData.get("required") === "on",
    options: value(formData, "options")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

export async function createVariable(formData: FormData) {
  const parsed = variableSchema.safeParse(variablePayload(formData));
  if (!parsed.success) redirect("/variables/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("variables")
    .insert({
      ...parsed.data,
      organization_id: organization.id
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) redirect("/variables/new?error=create");

  await audit("create_variable", "variables", data.id, organization.id);
  revalidatePath("/variables");
  redirect(`/variables/${data.id}`);
}

export async function updateVariable(formData: FormData) {
  const parsed = variableUpdateSchema.safeParse({
    id: value(formData, "id"),
    ...variablePayload(formData)
  });
  if (!parsed.success) redirect(`/variables/${value(formData, "id")}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { id, ...payload } = parsed.data;
  const { error } = await supabase
    .from("variables")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) redirect(`/variables/${id}/edit?error=update`);

  await audit("update_variable", "variables", id, organization.id);
  revalidatePath("/variables");
  revalidatePath(`/variables/${id}`);
  redirect(`/variables/${id}`);
}

export async function extractConversationVariables(formData: FormData) {
  const conversationId = value(formData, "conversation_id");
  if (!conversationId) redirect("/inbox?error=invalid-variable-extraction");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const variables = await loadActiveVariables(supabase, organization.id);
  const { context, leadId } = await buildConversationVariableContext({
    supabase,
    organizationId: organization.id,
    conversationId
  });
  const extractor = new VariableExtractor();
  const input = extractor.buildInput(variables, context);
  const results = extractor.extract(variables, context);
  let extractedCount = 0;

  for (const result of results) {
    const variable = variables.find((item) => item.id === result.variableId);
    if (!variable) continue;

    const { data: log } = await supabase
      .from("variable_extraction_logs")
      .insert({
        organization_id: organization.id,
        variable_id: variable.id,
        lead_id: leadId,
        conversation_id: conversationId,
        source_message_id: result.sourceMessageId,
        mode: "demo",
        extracted: result.extracted,
        value: result.value,
        confidence: result.confidence,
        reason: result.reason,
        input,
        output: result
      })
      .select("id")
      .single<{ id: string }>();

    if (result.extracted) {
      extractedCount += 1;
      await supabase.from("conversation_variables").upsert(
        {
          organization_id: organization.id,
          conversation_id: conversationId,
          variable_id: variable.id,
          value: result.value,
          confidence: result.confidence,
          source_message_id: result.sourceMessageId,
          extracted_at: new Date().toISOString()
        },
        { onConflict: "conversation_id,variable_id" },
      );

      if (leadId) {
        await upsertLeadVariable({
          supabase,
          organizationId: organization.id,
          leadId,
          variableId: variable.id,
          value: result.value,
          confidence: result.confidence,
          sourceMessageId: result.sourceMessageId
        });
      }
    }

    await audit("extract_variable", "variable_extraction_logs", log?.id, organization.id, {
      variable_id: variable.id,
      extracted: result.extracted
    });
  }

  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${conversationId}&variables=${extractedCount}`);
}

export async function extractLeadVariables(formData: FormData) {
  const leadId = value(formData, "lead_id");
  if (!leadId) redirect("/leads?error=invalid-variable-extraction");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const variables = await loadActiveVariables(supabase, organization.id);
  const context = await buildLeadVariableContext({
    supabase,
    organizationId: organization.id,
    leadId
  });
  const extractor = new VariableExtractor();
  const input = extractor.buildInput(variables, context);
  const results = extractor.extract(variables, context);
  let extractedCount = 0;

  for (const result of results) {
    const variable = variables.find((item) => item.id === result.variableId);
    if (!variable) continue;

    const { data: log } = await supabase
      .from("variable_extraction_logs")
      .insert({
        organization_id: organization.id,
        variable_id: variable.id,
        lead_id: leadId,
        source_message_id: result.sourceMessageId,
        mode: "demo",
        extracted: result.extracted,
        value: result.value,
        confidence: result.confidence,
        reason: result.reason,
        input,
        output: result
      })
      .select("id")
      .single<{ id: string }>();

    if (result.extracted) {
      extractedCount += 1;
      await upsertLeadVariable({
        supabase,
        organizationId: organization.id,
        leadId,
        variableId: variable.id,
        value: result.value,
        confidence: result.confidence,
        sourceMessageId: result.sourceMessageId
      });
    }

    await audit("extract_lead_variable", "variable_extraction_logs", log?.id, organization.id, {
      variable_id: variable.id,
      extracted: result.extracted
    });
  }

  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}?variables=${extractedCount}`);
}

async function loadActiveVariables(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], organizationId: string) {
  const { data } = await supabase
    .from("variables")
    .select("id, organization_id, name, key, description, type, extraction_prompt, active, required, options")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .returns<VariableRow[]>();

  return (data ?? []).map(mapVariable);
}

async function upsertLeadVariable({
  supabase,
  organizationId,
  leadId,
  variableId,
  value: extractedValue,
  confidence,
  sourceMessageId
}: {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  organizationId: string;
  leadId: string;
  variableId: string;
  value: unknown;
  confidence: number;
  sourceMessageId?: string | null;
}) {
  await supabase.from("lead_variables").upsert(
    {
      organization_id: organizationId,
      lead_id: leadId,
      variable_id: variableId,
      value: extractedValue,
      confidence,
      source_message_id: sourceMessageId,
      extracted_at: new Date().toISOString()
    },
    { onConflict: "lead_id,variable_id" },
  );
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
