"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { roleCapabilities } from "@/lib/permissions/roles";
import {
  listConnections,
  createConnection,
  disconnectConnection,
  logConnectionEvent,
  getConnectionWithTools,
  listConnectionLogs,
} from "@/lib/integrations/hub";
import { getAllProviderMetadata, getProvider } from "@crm-pro-ai/integrations/provider-registry";

const createConnectionSchema = z.object({
  provider_key: z.string().trim().min(1).max(80),
  display_name: z.string().trim().min(2).max(120),
});

const connectionIdSchema = z.object({
  connection_id: z.string().uuid(),
});

export async function getIntegrationHubOverview() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);

  const [connections, allProviderMeta] = await Promise.all([
    listConnections(supabase, organization.id),
    Promise.resolve(getAllProviderMetadata()),
  ]);

  const connectedKeys = new Set(
    connections.filter((c) => c.status === "connected").map((c) => c.provider_key)
  );

  return {
    connections,
    providers: allProviderMeta,
    connectedProviderKeys: [...connectedKeys],
    organizationId: organization.id,
    role: organization.role,
  };
}

export async function getConnectionDetail(connectionId: string) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);

  const [connection, logs] = await Promise.all([
    getConnectionWithTools(supabase, connectionId, organization.id),
    listConnectionLogs(supabase, connectionId, organization.id),
  ]);

  if (!connection) return null;

  return { connection, logs };
}

export async function createIntegrationConnection(formData: FormData) {
  const parsed = createConnectionSchema.safeParse({
    provider_key: formData.get("provider_key"),
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) redirect("/integrations/hub?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);

  if (!capabilities.manageIntegrations) {
    redirect("/integrations/hub?error=forbidden");
  }

  const provider = getProvider(parsed.data.provider_key);
  if (!provider) redirect("/integrations/hub?error=unknown-provider");

  const connection = await createConnection(supabase, {
    organizationId: organization.id,
    providerKey: parsed.data.provider_key,
    displayName: parsed.data.display_name,
    createdBy: user.id,
  });

  if (!connection) redirect("/integrations/hub?error=create-failed");

  revalidatePath("/integrations/hub");
  redirect(`/integrations/hub/${connection.id}?created=1`);
}

export async function disconnectIntegrationConnection(formData: FormData) {
  const parsed = connectionIdSchema.safeParse({
    connection_id: formData.get("connection_id"),
  });
  if (!parsed.success) redirect("/integrations/hub?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);

  if (!capabilities.manageIntegrations) {
    redirect("/integrations/hub?error=forbidden");
  }

  await disconnectConnection(supabase, parsed.data.connection_id, organization.id);

  revalidatePath("/integrations/hub");
  redirect("/integrations/hub?disconnected=1");
}

export async function testIntegrationConnection(formData: FormData) {
  const parsed = connectionIdSchema.safeParse({
    connection_id: formData.get("connection_id"),
  });
  if (!parsed.success) redirect("/integrations/hub?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);

  // Fire health check log entry
  await logConnectionEvent(supabase, {
    connectionId: parsed.data.connection_id,
    organizationId: organization.id,
    eventType: "health_check",
    message: `Prueba de conexion solicitada por usuario ${user.id}.`,
  });

  revalidatePath(`/integrations/hub/${parsed.data.connection_id}`);
  redirect(`/integrations/hub/${parsed.data.connection_id}?tested=1`);
}

export async function deleteIntegrationConnection(formData: FormData) {
  const parsed = connectionIdSchema.safeParse({
    connection_id: formData.get("connection_id"),
  });
  if (!parsed.success) redirect("/integrations/hub?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);

  if (!capabilities.manageIntegrations) {
    redirect("/integrations/hub?error=forbidden");
  }

  // Disconnect first (removes credentials)
  await disconnectConnection(supabase, parsed.data.connection_id, organization.id);

  // Delete the connection row
  await supabase
    .from("integration_connections")
    .delete()
    .eq("id", parsed.data.connection_id)
    .eq("organization_id", organization.id);

  revalidatePath("/integrations/hub");
  redirect("/integrations/hub?deleted=1");
}
