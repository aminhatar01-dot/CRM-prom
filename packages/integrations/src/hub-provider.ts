export type ConnectionStatus = "connected" | "disconnected" | "expired" | "requires_auth" | "error";
export type AuthType = "oauth2" | "api_key" | "token" | "webhook" | "none";
export type ProviderCategory = "messaging" | "ecommerce" | "productivity" | "advertising" | "social" | "storage" | "other";

export type HubToolField = {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  enum?: string[];
};

export type HubToolDefinition = {
  key: string;
  name: string;
  description: string;
  inputSchema: Record<string, HubToolField>;
};

export type HubConnection = {
  id: string;
  organizationId: string;
  providerKey: string;
  displayName: string;
  status: ConnectionStatus;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  scopes: string[];
  expiresAt?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  metadata: Record<string, unknown>;
};

export type HubToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
};

export type ConnectionHealth = {
  healthy: boolean;
  message: string;
  checkedAt: string;
};

export type OAuthParams = {
  organizationId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
};

export interface HubProvider {
  readonly key: string;
  readonly name: string;
  readonly category: ProviderCategory;
  readonly authType: AuthType;
  readonly description: string;
  readonly iconEmoji: string;

  /** All tools this provider can expose to AI assistants */
  getToolDefinitions(): HubToolDefinition[];

  /** Execute a specific tool for an active connection */
  executeTool(
    toolKey: string,
    input: Record<string, unknown>,
    connection: HubConnection
  ): Promise<HubToolResult>;

  /** Verify the connection is still valid */
  healthCheck(connection: HubConnection): Promise<ConnectionHealth>;

  /** Revoke tokens and clean up (token revocation is best-effort) */
  disconnect(connection: HubConnection): Promise<void>;

  /** Build OAuth authorization URL (only for oauth2 providers) */
  getAuthorizationUrl?(params: OAuthParams): string;
}

export type ProviderMetadata = {
  key: string;
  name: string;
  category: ProviderCategory;
  authType: AuthType;
  description: string;
  iconEmoji: string;
  toolCount: number;
};

export class HubProviderError extends Error {
  constructor(
    message: string,
    readonly providerKey: string,
    readonly toolKey?: string
  ) {
    super(message);
    this.name = "HubProviderError";
  }
}

export class HubNotImplementedError extends HubProviderError {
  constructor(providerKey: string, toolKey: string) {
    super(
      `Tool "${toolKey}" for provider "${providerKey}" is not yet implemented. This integration will be activated in a future phase.`,
      providerKey,
      toolKey
    );
    this.name = "HubNotImplementedError";
  }
}
