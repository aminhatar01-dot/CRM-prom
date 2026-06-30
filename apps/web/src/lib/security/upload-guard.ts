/**
 * Server-side upload validation.
 * Call validateUpload() before storing any file from a user.
 */

export type AllowedUploadType = "image" | "document" | "knowledge";

const CONFIGS = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    allowedMime: new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]),
    allowedExtensions: new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]),
  },
  document: {
    maxBytes: 20 * 1024 * 1024,
    allowedMime: new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ]),
    allowedExtensions: new Set([".pdf", ".docx", ".xlsx", ".txt", ".csv"]),
  },
  knowledge: {
    maxBytes: 10 * 1024 * 1024,
    allowedMime: new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "application/csv",
    ]),
    allowedExtensions: new Set([".pdf", ".docx", ".xlsx", ".txt", ".csv"]),
  },
} as const;

// Executable or dangerous file extensions — never allowed regardless of config
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".psd1",
  ".com", ".scr", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh",
  ".msi", ".msp", ".jar", ".py", ".rb", ".pl", ".php", ".asp", ".aspx",
  ".cgi", ".dmg", ".app", ".deb", ".rpm", ".apk",
]);

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

/**
 * Validate a file before upload. Throws UploadValidationError on any violation.
 */
export function validateUpload(
  file: { name: string; type: string; size: number },
  uploadType: AllowedUploadType,
): void {
  const config = CONFIGS[uploadType];

  // Filename safety
  const safeName = sanitizeFileName(file.name);
  const ext = getExtension(safeName);

  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new UploadValidationError(`Tipo de archivo no permitido: ${ext}`);
  }
  if (!config.allowedExtensions.has(ext)) {
    throw new UploadValidationError(`Extensión no permitida para este tipo de carga: ${ext}`);
  }

  // MIME type
  if (!config.allowedMime.has(file.type)) {
    throw new UploadValidationError(`Tipo MIME no permitido: ${file.type}`);
  }

  // Size
  if (file.size <= 0) {
    throw new UploadValidationError("El archivo está vacío.");
  }
  if (file.size > config.maxBytes) {
    throw new UploadValidationError(
      `El archivo supera el tamaño máximo permitido (${Math.round(config.maxBytes / 1024 / 1024)} MB).`,
    );
  }
}

/**
 * Sanitize a filename: remove path separators, null bytes, and dangerous characters.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[\0/\\:*?"<>|]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200)
    .trim() || "archivo";
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}
