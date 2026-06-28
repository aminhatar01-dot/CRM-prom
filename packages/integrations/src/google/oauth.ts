/** Pure Google OAuth helpers — no DB access, no encryption */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export type GoogleScopes = {
  gmail?: boolean;
  calendar?: boolean;
  sheets?: boolean;
  drive?: boolean;
};

export const GOOGLE_SCOPE_MAP = {
  gmail_read:     "https://www.googleapis.com/auth/gmail.readonly",
  gmail_send:     "https://www.googleapis.com/auth/gmail.send",
  calendar_read:  "https://www.googleapis.com/auth/calendar.readonly",
  calendar_write: "https://www.googleapis.com/auth/calendar.events",
  sheets_read:    "https://www.googleapis.com/auth/spreadsheets.readonly",
  sheets_write:   "https://www.googleapis.com/auth/spreadsheets",
  drive_read:     "https://www.googleapis.com/auth/drive.readonly",
  drive_meta:     "https://www.googleapis.com/auth/drive.metadata.readonly",
  profile:        "https://www.googleapis.com/auth/userinfo.profile",
  email:          "https://www.googleapis.com/auth/userinfo.email",
} as const;

export const DEFAULT_SCOPES_BY_PROVIDER: Record<string, string[]> = {
  gmail: [
    GOOGLE_SCOPE_MAP.email,
    GOOGLE_SCOPE_MAP.profile,
    GOOGLE_SCOPE_MAP.gmail_read,
    GOOGLE_SCOPE_MAP.gmail_send,
  ],
  google_calendar: [
    GOOGLE_SCOPE_MAP.email,
    GOOGLE_SCOPE_MAP.profile,
    GOOGLE_SCOPE_MAP.calendar_read,
    GOOGLE_SCOPE_MAP.calendar_write,
  ],
  google_sheets: [
    GOOGLE_SCOPE_MAP.email,
    GOOGLE_SCOPE_MAP.profile,
    GOOGLE_SCOPE_MAP.sheets_read,
    GOOGLE_SCOPE_MAP.sheets_write,
  ],
  google_drive: [
    GOOGLE_SCOPE_MAP.email,
    GOOGLE_SCOPE_MAP.profile,
    GOOGLE_SCOPE_MAP.drive_meta,
    GOOGLE_SCOPE_MAP.drive_read,
  ],
};

export const GOOGLE_PROVIDER_KEYS = ["gmail", "google_calendar", "google_sheets", "google_drive"] as const;
export type GoogleProviderKey = typeof GOOGLE_PROVIDER_KEYS[number];

export function isGoogleProvider(key: string): key is GoogleProviderKey {
  return GOOGLE_PROVIDER_KEYS.includes(key as GoogleProviderKey);
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export type GoogleUserInfo = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  providerKey: GoogleProviderKey;
  scopes?: string[];
}): string {
  const scopes = params.scopes ?? DEFAULT_SCOPES_BY_PROVIDER[params.providerKey] ?? [];

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id",     params.clientId);
  url.searchParams.set("redirect_uri",  params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         scopes.join(" "));
  url.searchParams.set("state",         params.state);
  url.searchParams.set("access_type",   "offline");
  url.searchParams.set("prompt",        "consent"); // force refresh_token
  return url.toString();
}

export async function exchangeGoogleCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      code:          params.code,
      client_id:     params.clientId,
      client_secret: params.clientSecret,
      redirect_uri:  params.redirectUri,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }
  return res.json() as Promise<GoogleTokenResponse>;
}

export async function refreshGoogleToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: params.refreshToken,
      client_id:     params.clientId,
      client_secret: params.clientSecret,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`);
  // best-effort, ignore errors
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return res.json() as Promise<GoogleUserInfo>;
}
