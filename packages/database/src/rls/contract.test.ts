import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("RLS migration contract", () => {
  it("enables row level security for every public table created by migrations", () => {
    const migrationsDir = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
      .join("\n");

    const tables = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((match) => match[1]);
    const rlsTables = new Set([...sql.matchAll(/alter table public\.([a-z_]+) enable row level security/g)].map((match) => match[1]));
    const missing = [...new Set(tables)].filter((table) => !rlsTables.has(table));

    expect(missing).toEqual([]);
  });
});
