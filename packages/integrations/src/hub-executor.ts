import { getProviderOrThrow } from "./provider-registry";
import { HubNotImplementedError, type HubConnection, type HubToolResult } from "./hub-provider";

export type HubToolExecutionParams = {
  connection: HubConnection;
  toolKey: string;
  input: Record<string, unknown>;
  organizationId: string;
};

export type HubExecutionResult = HubToolResult & {
  providerKey: string;
  toolKey: string;
  connectionId: string;
  notImplemented?: boolean;
};

export async function executeHubTool(params: HubToolExecutionParams): Promise<HubExecutionResult> {
  const { connection, toolKey, input, organizationId } = params;

  if (connection.organizationId !== organizationId) {
    return {
      success: false,
      error: "Cross-tenant tool execution rejected.",
      durationMs: 0,
      providerKey: connection.providerKey,
      toolKey,
      connectionId: connection.id
    };
  }

  if (connection.status !== "connected") {
    return {
      success: false,
      error: `Connection "${connection.displayName}" is not active (status: ${connection.status}). Reconnect or refresh this integration.`,
      durationMs: 0,
      providerKey: connection.providerKey,
      toolKey,
      connectionId: connection.id
    };
  }

  const provider = getProviderOrThrow(connection.providerKey);

  const start = Date.now();
  try {
    const result = await provider.executeTool(toolKey, input, connection);
    return {
      ...result,
      durationMs: result.durationMs || Date.now() - start,
      providerKey: connection.providerKey,
      toolKey,
      connectionId: connection.id
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    if (error instanceof HubNotImplementedError) {
      return {
        success: false,
        error: error.message,
        durationMs,
        providerKey: connection.providerKey,
        toolKey,
        connectionId: connection.id,
        notImplemented: true
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Hub tool execution failed.",
      durationMs,
      providerKey: connection.providerKey,
      toolKey,
      connectionId: connection.id
    };
  }
}
