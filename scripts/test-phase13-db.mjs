import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];

if (!projectId) {
  throw new Error("Unable to read project_id from supabase/config.toml");
}

const container = process.env.PHASE13_DB_CONTAINER || `supabase_db_${projectId}`;
const sql = readFileSync(
  path.join(root, "supabase", "tests", "phase_13_integrity_crud.sql"),
  "utf8",
);
const result = spawnSync(
  "docker",
  ["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  {
    cwd: root,
    encoding: "utf8",
    input: sql,
    shell: process.platform === "win32"
  },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!output.includes("1..20") || output.includes("not ok")) {
  throw new Error("Phase 13 pgTAP suite did not complete successfully.");
}
