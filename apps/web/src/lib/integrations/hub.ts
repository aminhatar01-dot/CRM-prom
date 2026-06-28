import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderOrThrow, getAllProviderMetadata } from "@crm-pro-ai/integrations/provider-registry";
import type { HubConnection } from "@crm-pro-ai/integrations/hub-provider";

export type ConnectionRow = {
  id: string;
  organization_id: string;
  provider_key: string;
  display_name: string;
  status: string;
  external_account_id: string | null;
  external_account_name: string | null;
  scopes: string[];
  expires_at: string | null;
  last_refreshed_at: string | null;
  last_sync_at: string | null;
  last_health_check_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HubConnectionWithMeta = ConnectionRow & {
  providerName: string;
  providerEmoji: string;
  toolCount: number;
};

export function toHubConnection(row: ConnectionRow): HubConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerKey: row.provider_key,
    displayName: row.display_name,
    status: row.status as HubConnection["status"],
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    scopes: row.scopes ?? [],
    expiresAt: row.expires_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    metadata: row.metadata ?? {}
  };
}

export async function listConnections(
  supabase: SupabaseClient,
  organizationId: string
): Promise<HubConnectionWithMeta[]> {
  const { data } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<ConnectionRow[]>();

  const allMeta = getAllProviderMetadata();
  const metaMap = new Map(allMeta.map((m) => [m.key, m]));

  return (data ?? []).map((row) => {
    const meta = metaMap.get(row.provider_key);
    return {
      ...row,
      providerName: meta?.name ?? row.provider_key,
      providerEmoji: meta?.iconEmoji ?? "🔌",
      toolCount: meta?.toolCount ?? 0
    };
  });
}

export async function createConnection(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    providerKey: string;
    displayName: string;
    createdBy: string;
    externalAccountId?: string;
    externalAccountName?: string;
    scopes?: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<ConnectionRow | null> {
  // validate provider exists
  getProviderOrThrow(params.providerKey);

  const { data, error } = await supabase
    .from("integration_connections")
    .insert({
      organization_id: params.organizationId,
      provider_key: params.providerKey,
      display_name: params.displayName,
      status: "disconnected",
      external_account_id: params.externalAccountId ?? null,
      external_account_name: params.externalAccountName ?? null,
      scopes: params.scopes ?? [],
      metadata: params.metadata ?? {},
      created_by: params.createdBy
    })
    .select("*")
    .single<ConnectionRow>();

  if (error || !data) return null;

  // Populate hub tools for this connection
  const provider = getProviderOrThrow(params.providerKey);
  const toolDefs = provider.getToolDefinitions();
  if (toolDefs.length > 0) {
    await supabase.from("integration_hub_tools").insert(
      toolDefs.map((t) => ({
        connection_id: data.id,
        organization_id: params.organizationId,
        provider_key: params.providerKey,
        tool_key: t.key,
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
        output_schema: {},
        enabled: true
      }))
    );
  }

  await logConnectionEvent(supabase, {
    connectionId: data.id,
    organizationId: params.organizationId,
    eventType: "disconnected",
    message: `Conexion "${params.displayName}" creada para proveedor ${params.providerKey}.`
  });

  return data;
}

export async function updateConnectionStatus(
  supabase: SupabaseClient,
  params: {
    connectionId: string;
    organizationId: string;
    status: HubConnection["status"];
    lastError?: string | null;
    externalAccountId?: string;
    externalAccountName?: string;
    scopes?: string[];
  }
): Promise<void> {
  await supabase
    .from("integration_connections")
    .update({
      status: params.status,
      last_error: params.lastError ?? null,
      ...(params.externalAccountId ? { external_account_id: params.externalAccountId } : {}),
      ...(params.externalAccountName ? { external_account_name: params.externalAccountName } : {}),
      ...(params.scopes ? { scopes: params.scopes } : {})
    })
    .eq("id", params.connectionId)
    .eq("organization_id", params.organizationId);
}

export async function disconnectConnection(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string
): Promise<void> {
  await supabase.rpc("disconnect_integration_connection", {
    p_connection_id: connectionId,
    p_organization_id: organizationId
  });
}

export async function logConnectionEvent(
  supabase: SupabaseClient,
  params: {
    connectionId: string;
    organizationId: string;
    eventType: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from("integration_connection_logs").insert({
    connection_id: params.connectionId,
    organization_id: params.organizationId,
    event_type: params.eventType,
    message: params.message ?? "",
    metadata: params.metadata ?? {}
  });
}

export async function getConnectionWithTools(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string
): Promise<(ConnectionRow & { tools: Array<{ id: string; tool_key: string; name: string; enabled: boolean }> }) | null> {
  const { data } = await supabase
    .from("integration_connections")
    .select("*, integration_hub_tools(id, tool_key, name, enabled)")
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .single<ConnectionRow & { integration_hub_tools: Array<{ id: string; tool_key: string; name: string; enabled: boolean }> }>();

  if (!data) return null;

  const { integration_hub_tools: tools, ...row } = data;
  return { ...row, tools: tools ?? [] };
}

export async function listConnectionLogs(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string,
  limit = 20
) {
  const { data } = await supabase
    .from("integration_connection_logs")
    .select("id, event_type, message, metadata, created_at")
    .eq("connection_id", connectionId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Array<{ id: string; event_type: string; message: string; metadata: Record<string, unknown>; created_at: string }>>();

  return data ?? [];
}
