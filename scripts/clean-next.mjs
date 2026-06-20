import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDirectory = path.resolve(repositoryRoot, "apps", "web", ".next");
const expectedDirectory = path.join(repositoryRoot, "apps", "web", ".next");

if (nextDirectory !== expectedDirectory || !nextDirectory.startsWith(repositoryRoot + path.sep)) {
  throw new Error(`Refusing to clean unexpected path: ${nextDirectory}`);
}

await rm(nextDirectory, { recursive: true, force: true });
