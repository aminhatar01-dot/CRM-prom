import type { PostgrestError } from "@supabase/supabase-js";

export type ActionErrorCode =
  | "duplicate"
  | "forbidden"
  | "invalid-reference"
  | "tenant-integrity"
  | "not-found"
  | "database";

export function actionErrorCode(error: Pick<PostgrestError, "code" | "message"> | null): ActionErrorCode {
  if (!error) return "database";
  if (error.code === "23505") return "duplicate";
  if (error.code === "42501" || error.code === "PGRST301") return "forbidden";
  if (error.code === "23503") return "invalid-reference";
  if (error.code === "23514" || error.message.toLowerCase().includes("same organization")) {
    return "tenant-integrity";
  }
  if (error.code === "PGRST116") return "not-found";
  return "database";
}

export function addQueryParam(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
