import { z } from "zod";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional()
});

const debugTokenSchema = z.object({
  data: z.object({
    app_id: z.string().optional(),
    type: z.string().optional(),
    application: z.string().optional(),
    data_access_expires_at: z.number().optional(),
    expires_at: z.number().optional(),
    is_valid: z.boolean(),
    scopes: z.array(z.string()).optional(),
    granular_scopes: z.array(z.unknown()).optional(),
    user_id: z.string().optional()
  })
});

const phoneNumbersSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      display_phone_number: z.string().optional(),
      verified_name: z.string().optional(),
      quality_rating: z.string().optional(),
      status: z.string().optional()
    }),
  )
});

const successSchema = z.object({ success: z.boolean() });

export type MetaEmbeddedSignupConfig = {
  appId: string;
  appSecret: string;
  graphApiVersion?: string;
  fetcher?: typeof fetch;
};

export class MetaEmbeddedSignupService {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly graphApiVersion: string;
  private readonly fetcher: typeof fetch;

  constructor(config: MetaEmbeddedSignupConfig) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.graphApiVersion = config.graphApiVersion ?? "v23.0";
    this.fetcher = config.fetcher ?? fetch;
  }

  async exchangeCode(code: string) {
    const url = this.url("/oauth/access_token", {
      client_id: this.appId,
      client_secret: this.appSecret,
      code
    });
    return tokenResponseSchema.parse(await this.request(url));
  }

  async debugToken(accessToken: string) {
    const url = this.url("/debug_token", {
      input_token: accessToken
    });
    return debugTokenSchema.parse(await this.request(url, undefined, `${this.appId}|${this.appSecret}`)).data;
  }

  async getPhoneNumbers(wabaId: string, accessToken: string) {
    const url = this.url(`/${wabaId}/phone_numbers`, {
      fields: "id,display_phone_number,verified_name,quality_rating,status"
    });
    return phoneNumbersSchema.parse(await this.request(url, undefined, accessToken)).data;
  }

  async subscribeApp(wabaId: string, accessToken: string) {
    const url = this.url(`/${wabaId}/subscribed_apps`, {
      subscribed_fields: "messages"
    });
    return successSchema.parse(await this.request(url, { method: "POST" }, accessToken));
  }

  async refreshLongLivedToken(accessToken: string) {
    const url = this.url("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: accessToken
    });
    return tokenResponseSchema.parse(await this.request(url));
  }

  private url(path: string, params: Record<string, string>) {
    const url = new URL(`https://graph.facebook.com/${this.graphApiVersion}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url;
  }

  private async request(url: URL, init?: RequestInit, accessToken?: string) {
    const response = await this.fetcher(url, {
      ...init,
      headers: {
        ...init?.headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload &&
        "error" in payload &&
        typeof payload.error === "object" &&
        payload.error &&
        "message" in payload.error
          ? String(payload.error.message)
          : "Meta Graph API request failed.";
      throw new MetaGraphError(message, response.status, payload);
    }
    return payload;
  }
}

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}
