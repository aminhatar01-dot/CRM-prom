import crypto from "node:crypto";

const VERSION = "v1";

export function encryptWhatsAppToken(token: string, encodedKey: string) {
  const key = decodeKey(encodedKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptWhatsAppToken(value: string, encodedKey: string) {
  const [version, ivValue, authTagValue, encryptedValue] = value.split(".");
  if (version !== VERSION || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Invalid encrypted WhatsApp credential.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", decodeKey(encodedKey), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function createEmbeddedSignupState({
  organizationId,
  userId,
  appSecret,
  now = Date.now()
}: {
  organizationId: string;
  userId: string;
  appSecret: string;
  now?: number;
}) {
  const payload = Buffer.from(
    JSON.stringify({
      organizationId,
      userId,
      expiresAt: now + 10 * 60_000,
      nonce: crypto.randomBytes(16).toString("hex")
    }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", appSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyEmbeddedSignupState({
  state,
  organizationId,
  userId,
  appSecret,
  now = Date.now()
}: {
  state: string;
  organizationId: string;
  userId: string;
  appSecret: string;
  now?: number;
}) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      organizationId: string;
      userId: string;
      expiresAt: number;
    };
    return decoded.organizationId === organizationId && decoded.userId === userId && decoded.expiresAt > now;
  } catch {
    return false;
  }
}

function decodeKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
  return key;
}
