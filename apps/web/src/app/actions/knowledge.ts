"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  knowledgeDocumentIdSchema,
  knowledgeDocumentSchema,
  knowledgeDocumentUpdateSchema
} from "@crm-pro-ai/ai/knowledge";
import { actionErrorCode } from "@/lib/action-errors";
import { requireUser } from "@/lib/auth";
import { indexKnowledgeDocument } from "@/lib/knowledge/service";
import { getActiveOrganization } from "@/lib/organization";

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function payload(formData: FormData) {
  return {
    title: value(formData, "title"),
    content: value(formData, "content"),
    category: value(formData, "category") || "general",
    active: formData.get("active") === "on"
  };
}

export async function createKnowledgeDocument(formData: FormData) {
  const parsed = knowledgeDocumentSchema.safeParse(payload(formData));
  if (!parsed.success) redirect("/knowledge/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      ...parsed.data,
      organization_id: organization.id,
      created_by: user.id,
      source_type: "manual",
      indexing_status: "pending"
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) redirect(`/knowledge/new?error=${actionErrorCode(error)}`);

  await audit(supabase, organization.id, user.id, "create_knowledge_document", data.id);
  try {
    const indexed = await indexKnowledgeDocument(data.id, organization.id);
    await audit(supabase, organization.id, user.id, "index_knowledge_document", data.id, indexed);
  } catch {
    revalidatePath("/knowledge");
    redirect(`/knowledge/${data.id}?error=knowledge-indexing`);
  }
  revalidatePath("/knowledge");
  redirect(`/knowledge/${data.id}?success=indexed`);
}

export async function updateKnowledgeDocument(formData: FormData) {
  const parsed = knowledgeDocumentUpdateSchema.safeParse({
    id: value(formData, "id"),
    ...payload(formData)
  });
  if (!parsed.success) redirect(`/knowledge/${value(formData, "id")}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { id, ...updates } = parsed.data;
  const { data, error } = await supabase
    .from("knowledge_documents")
    .update({
      ...updates,
      indexing_status: "pending",
      indexing_error: null
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) redirect(`/knowledge/${id}/edit?error=${actionErrorCode(error)}`);
  if (!data) redirect(`/knowledge/${id}/edit?error=not-found`);

  await audit(supabase, organization.id, user.id, "update_knowledge_document", id);
  try {
    const indexed = await indexKnowledgeDocument(id, organization.id);
    await audit(supabase, organization.id, user.id, "reindex_knowledge_document", id, indexed);
  } catch {
    revalidatePath("/knowledge");
    redirect(`/knowledge/${id}?error=knowledge-indexing`);
  }
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${id}`);
  redirect(`/knowledge/${id}?success=indexed`);
}

export async function reindexKnowledgeDocument(formData: FormData) {
  const parsed = knowledgeDocumentIdSchema.safeParse({ id: value(formData, "id") });
  if (!parsed.success) redirect("/knowledge?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  try {
    const indexed = await indexKnowledgeDocument(parsed.data.id, organization.id);
    await audit(supabase, organization.id, user.id, "reindex_knowledge_document", parsed.data.id, indexed);
  } catch {
    redirect(`/knowledge/${parsed.data.id}?error=knowledge-indexing`);
  }
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${parsed.data.id}`);
  redirect(`/knowledge/${parsed.data.id}?success=indexed`);
}

export async function archiveKnowledgeDocument(formData: FormData) {
  const parsed = knowledgeDocumentIdSchema.safeParse({ id: value(formData, "id") });
  if (!parsed.success) redirect("/knowledge?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("knowledge_documents")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) redirect(`/knowledge?error=${actionErrorCode(error)}`);
  if (!data) redirect("/knowledge?error=not-found");

  await audit(supabase, organization.id, user.id, "archive_knowledge_document", parsed.data.id);
  revalidatePath("/knowledge");
  redirect("/knowledge?success=archived");
}

async function audit(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  organizationId: string,
  userId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action,
    entity_table: "knowledge_documents",
    entity_id: entityId,
    metadata
  });
}

