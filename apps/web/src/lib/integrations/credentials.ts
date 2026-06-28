import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const raw = process.env.HUB_CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("HUB_CREDENTIAL_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("HUB_CREDENTIAL_ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)");
  return buf;
}

export function encryptCredential(value: string): string {
  const key = getEncryptionKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptCredential(encoded: string): string {
  const parts = encoded.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid credential format");
  }
  const [, ivB64, authTagB64, encryptedB64] = parts;
  const key       = getEncryptionKey();
  const iv        = Buffer.from(ivB64, "base64url");
  const authTag   = Buffer.from(authTagB64, "base64url");
  const encrypted = Buffer.from(encryptedB64, "base64url");
  const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
}

export async function storeCredential(
  adminSupabase: SupabaseClient,
  connectionId: string,
  orgId: string,
  type: string,
  value: string,
  expiresAt?: Date,
): Promise<void> {
  const encrypted = encryptCredential(value);
  const { error } = await adminSupabase.rpc("store_hub_credential", {
    p_connection_id:   connectionId,
    p_organization_id: orgId,
    p_credential_type: type,
    p_encrypted_value: encrypted,
    p_expires_at:      expiresAt?.toISOString() ?? null,
  });
  if (error) throw new Error(`Failed to store credential: ${error.message}`);
}

export async function getDecryptedCredential(
  adminSupabase: SupabaseClient,
  connectionId: string,
  orgId: string,
  type: string,
): Promise<string | null> {
  const { data, error } = await adminSupabase.rpc("get_hub_credential", {
    p_connection_id:   connectionId,
    p_organization_id: orgId,
    p_credential_type: type,
  });
  if (error) throw new Error(`Failed to get credential: ${error.message}`);
  if (!data) return null;
  return decryptCredential(data as string);
}

export async function deleteConnectionCredentials(
  adminSupabase: SupabaseClient,
  connectionId: string,
  orgId: string,
): Promise<void> {
  const { error } = await adminSupabase.rpc("delete_hub_credentials", {
    p_connection_id:   connectionId,
    p_organization_id: orgId,
  });
  if (error) throw new Error(`Failed to delete credentials: ${error.message}`);
}

/** Build a getCredential callback for executeHubTool context */
export function makeGetCredential(
  adminSupabase: SupabaseClient,
  connectionId: string,
  orgId: string,
): (type: string) => Promise<string | null> {
  return (type: string) => getDecryptedCredential(adminSupabase, connectionId, orgId, type);
}
