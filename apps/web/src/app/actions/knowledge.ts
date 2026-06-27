"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  knowledgeDocumentIdSchema,
  knowledgeDocumentSchema,
  knowledgeDocumentUpdateSchema
} from "@crm-pro-ai/ai/knowledge";
import { catalogFields, knowledgeImportSchema, type ColumnMapping } from "@crm-pro-ai/ai/knowledge-import";
import { actionErrorCode } from "@/lib/action-errors";
import { requireUser } from "@/lib/auth";
import { indexKnowledgeDocument } from "@/lib/knowledge/service";
import { processKnowledgeImport, validateKnowledgeFile } from "@/lib/knowledge/import-service";
import { getActiveOrganization } from "@/lib/organization";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function createKnowledgeImport(formData: FormData) {
  const columnMapping = Object.fromEntries(
    catalogFields.flatMap((field) => {
      const column = value(formData, `column_${field}`).trim();
      return column ? [[field, column]] : [];
    }),
  ) as ColumnMapping;
  const parsed = knowledgeImportSchema.safeParse({
    name: value(formData, "name"),
    source_type: value(formData, "source_type"),
    source_url: value(formData, "source_url") || null,
    category: value(formData, "category") || "general",
    column_mapping: columnMapping
  });
  if (!parsed.success) redirect("/knowledge/import?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const fileSource = ["csv", "xlsx", "pdf", "docx", "txt"].includes(parsed.data.source_type);
  if (fileSource && !file) redirect("/knowledge/import?error=file-required");
  if (file) {
    try {
      validateKnowledgeFile(file, parsed.data.source_type);
    } catch {
      redirect("/knowledge/import?error=unsafe-file");
    }
  }

  const { data: source, error } = await supabase.from("knowledge_imports").insert({
    organization_id: organization.id,
    source_type: parsed.data.source_type,
    name: parsed.data.name,
    source_url: parsed.data.source_url,
    original_file_name: file?.name ?? null,
    mime_type: file?.type ?? null,
    size_bytes: file?.size ?? null,
    column_mapping: parsed.data.column_mapping,
    metadata: { category: parsed.data.category, file_last_modified: file?.lastModified ?? null },
    status: "pending",
    created_by: user.id
  }).select("id").single<{ id: string }>();
  if (error || !source) redirect(`/knowledge/import?error=${actionErrorCode(error)}`);

  if (file) {
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120);
    const storagePath = `${organization.id}/${source.id}/${safeName}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage.from("knowledge-imports")
      .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploadError) {
      await supabase.from("knowledge_imports").update({ status: "error", error_message: "No se pudo guardar el archivo original." })
        .eq("id", source.id).eq("organization_id", organization.id);
      redirect("/knowledge?error=import-storage");
    }
    await supabase.from("knowledge_imports").update({ storage_path: storagePath })
      .eq("id", source.id).eq("organization_id", organization.id);
  }

  await audit(supabase, organization.id, user.id, "create_knowledge_import", source.id, { source_type: parsed.data.source_type });
  try {
    const result = await processKnowledgeImport(source.id, organization.id);
    await audit(supabase, organization.id, user.id, "process_knowledge_import", source.id, result);
  } catch {
    revalidatePath("/knowledge");
    redirect("/knowledge?error=import-processing");
  }
  revalidatePath("/knowledge");
  redirect("/knowledge?success=imported");
}

export async function reindexKnowledgeImport(formData: FormData) {
  const parsed = knowledgeDocumentIdSchema.safeParse({ id: value(formData, "id") });
  if (!parsed.success) redirect("/knowledge?error=invalid");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  try {
    const result = await processKnowledgeImport(parsed.data.id, organization.id);
    await audit(supabase, organization.id, user.id, "reindex_knowledge_import", parsed.data.id, result);
  } catch {
    redirect("/knowledge?error=import-processing");
  }
  revalidatePath("/knowledge");
  redirect("/knowledge?success=reindexed");
}

export async function archiveKnowledgeImport(formData: FormData) {
  const parsed = knowledgeDocumentIdSchema.safeParse({ id: value(formData, "id") });
  if (!parsed.success) redirect("/knowledge?error=invalid");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("knowledge_imports")
    .update({ archived_at: now }).eq("id", parsed.data.id).eq("organization_id", organization.id)
    .is("archived_at", null).select("id").maybeSingle<{ id: string }>();
  if (error || !data) redirect("/knowledge?error=not-found");
  await supabase.from("knowledge_documents").update({ archived_at: now, active: false })
    .eq("organization_id", organization.id).eq("import_id", parsed.data.id).is("archived_at", null);
  await audit(supabase, organization.id, user.id, "archive_knowledge_import", parsed.data.id);
  revalidatePath("/knowledge");
  redirect("/knowledge?success=source-archived");
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
