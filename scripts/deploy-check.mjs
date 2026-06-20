import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const requiredEnvNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
];

export const requiredDocs = [
  "PROJECT_SPEC.md",
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/DEPLOYMENT_VERCEL_SUPABASE.md",
  "docs/PRODUCTION_CHECKLIST.md",
  "docs/DEPLOY_ASSISTANT.md",
  "docs/DEPLOY_CHECKLIST.md",
  "docs/NEXT_STEPS_FOR_USER.md",
  "docs/PHASE_11_VALIDATION.md",
  "docs/QA_E2E_PLAN.md",
  "docs/PHASE_12_VALIDATION.md"
];

const secretPatterns = [
  { label: "OpenAI API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { label: "Meta access token", pattern: /\bEA[A-Za-z0-9]{40,}\b/g },
  { label: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
];

function result(name, status, detail) {
  return { name, status, detail };
}

export function parseEnv(content) {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
}

export function loadLocalEnv(root) {
  const candidates = [
    resolve(root, ".env.local"),
    resolve(root, "apps/web/.env.local")
  ];
  const loaded = {};

  for (const file of candidates) {
    if (existsSync(file)) {
      Object.assign(loaded, parseEnv(readFileSync(file, "utf8")));
    }
  }

  return { ...loaded, ...process.env };
}

export function checkEnvironment(env, strict = false) {
  const checks = [];
  const missing = requiredEnvNames.filter((name) => !env[name]);
  checks.push(
    result(
      "Required environment variables",
      missing.length === 0 ? "pass" : strict ? "fail" : "warn",
      missing.length === 0 ? "Configured" : `Missing: ${missing.join(", ")}`
    )
  );

  if (env.AI_DEMO_MODE === "false" && !env.OPENAI_API_KEY) {
    checks.push(
      result(
        "OpenAI production mode",
        strict ? "fail" : "warn",
        "AI_DEMO_MODE=false requires OPENAI_API_KEY"
      )
    );
  } else {
    checks.push(result("OpenAI mode", "pass", env.OPENAI_API_KEY ? "API configured" : "Demo mode available"));
  }

  const whatsappValues = [
    env.WHATSAPP_VERIFY_TOKEN,
    env.WHATSAPP_ACCESS_TOKEN,
    env.WHATSAPP_PHONE_NUMBER_ID
  ];
  const whatsappCount = whatsappValues.filter(Boolean).length;
  checks.push(
    result(
      "WhatsApp configuration",
      whatsappCount === 0 || whatsappCount === whatsappValues.length ? "pass" : strict ? "fail" : "warn",
      whatsappCount === 0
        ? "Not configured; demo/manual CRM remains available"
        : whatsappCount === whatsappValues.length
          ? "Core WhatsApp variables configured"
          : "Partial WhatsApp configuration"
    )
  );

  return checks;
}

export function checkRuntime() {
  const npm = spawnSync("npm", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  return [
    result("Node.js", "pass", process.version),
    result(
      "npm",
      npm.status === 0 ? "pass" : "fail",
      npm.status === 0 ? npm.stdout.trim() : npm.stderr.trim() || "npm is unavailable"
    )
  ];
}

export function checkMigrations(root) {
  const migrationsDir = resolve(root, "supabase/migrations");
  if (!existsSync(migrationsDir)) {
    return [result("Supabase migrations", "fail", "supabase/migrations does not exist")];
  }

  const migrations = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
  return [
    result(
      "Supabase migrations",
      migrations.length > 0 ? "pass" : "fail",
      `${migrations.length} SQL migration(s) found`
    )
  ];
}

export function checkRequiredDocs(root, docs = requiredDocs) {
  const missing = docs.filter((file) => !existsSync(resolve(root, file)));
  return [
    result(
      "Critical deployment documentation",
      missing.length === 0 ? "pass" : "fail",
      missing.length === 0 ? `${docs.length} documents found` : `Missing: ${missing.join(", ")}`
    )
  ];
}

export function checkPackageScripts(root) {
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const expected = [
    "predeploy",
    "deploy:check",
    "env:check",
    "db:check",
    "app:check",
    "qa:smoke",
    "qa:e2e",
    "validate",
    "db:push",
    "db:seed"
  ];
  const missing = expected.filter((name) => !packageJson.scripts?.[name]);
  return [
    result(
      "Deployment npm scripts",
      missing.length === 0 ? "pass" : "fail",
      missing.length === 0 ? `${expected.length} scripts found` : `Missing: ${missing.join(", ")}`
    )
  ];
}

export function checkHealthRoute(root) {
  const route = resolve(root, "apps/web/src/app/api/health/route.ts");
  const valid = existsSync(route) && /export\s+async\s+function\s+GET/.test(readFileSync(route, "utf8"));
  return [
    result(
      "Health route",
      valid ? "pass" : "fail",
      valid ? "GET /api/health is implemented" : "Health route is missing or invalid"
    )
  ];
}

export function getTrackedFiles(root) {
  const git = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  );
  if (git.status !== 0) return [];
  return git.stdout.split("\0").filter(Boolean);
}

export function checkEnvLocalIgnored(root, trackedFiles = getTrackedFiles(root)) {
  const tracked = trackedFiles.filter((file) => /(^|\/)\.env(?:\.[^/]+)?\.local$/.test(file));
  const git = spawnSync("git", ["check-ignore", ".env.local", "apps/web/.env.local"], {
    cwd: root,
    encoding: "utf8"
  });
  const ignored = git.status === 0;

  return [
    result(
      ".env.local Git safety",
      tracked.length === 0 && ignored ? "pass" : "fail",
      tracked.length > 0
        ? `Tracked local env files: ${tracked.join(", ")}`
        : ignored
          ? ".env.local files are ignored and untracked"
          : ".env.local ignore rule is missing"
    )
  ];
}

export function checkHardcodedSecrets(root, trackedFiles = getTrackedFiles(root)) {
  const findings = [];
  const textExtensions = /\.(?:[cm]?[jt]sx?|json|md|sql|ya?ml|toml|env|example)$/i;

  for (const relativePath of trackedFiles) {
    if (!textExtensions.test(relativePath) || relativePath.endsWith("package-lock.json")) continue;
    const file = resolve(root, relativePath);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const secret of secretPatterns) {
      secret.pattern.lastIndex = 0;
      if (secret.pattern.test(content)) findings.push(`${secret.label}: ${relativePath}`);
    }
  }

  return [
    result(
      "Obvious hardcoded secrets",
      findings.length === 0 ? "pass" : "fail",
      findings.length === 0 ? "No obvious secrets found in repository files" : findings.join("; ")
    )
  ];
}

export function checkServiceRoleFrontend(root, trackedFiles = getTrackedFiles(root)) {
  const findings = [];

  for (const relativePath of trackedFiles.filter((file) => file.startsWith("apps/web/src/"))) {
    const file = resolve(root, relativePath);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    if (content.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) {
      findings.push(relativePath);
      continue;
    }
    if (/^\s*["']use client["'];/m.test(content) && content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      findings.push(relativePath);
    }
  }

  return [
    result(
      "Service role frontend isolation",
      findings.length === 0 ? "pass" : "fail",
      findings.length === 0 ? "Service role is not referenced by client modules" : findings.join(", ")
    )
  ];
}

export async function checkSupabaseConnection(env, strict = false) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return result(
      "Supabase connection",
      strict ? "fail" : "warn",
      "Skipped because URL or anon key is missing"
    );
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "GET",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(5000)
    });
    return result(
      "Supabase connection",
      response.ok ? "pass" : strict ? "fail" : "warn",
      `HTTP ${response.status}`
    );
  } catch (error) {
    return result(
      "Supabase connection",
      strict ? "fail" : "warn",
      error instanceof Error ? error.message : "Connection failed"
    );
  }
}

export function runBuild(root) {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit"
  });
  return result("Local production build", build.status === 0 ? "pass" : "fail", `Exit code ${build.status ?? 1}`);
}

export async function runChecks({ root, scope = "all", strict = false, build = false }) {
  const env = loadLocalEnv(root);
  const checks = [];

  if (scope === "all" || scope === "env") {
    checks.push(...checkRuntime(), ...checkEnvironment(env, strict));
  }
  if (scope === "all" || scope === "db") {
    checks.push(...checkMigrations(root), await checkSupabaseConnection(env, strict));
  }
  if (scope === "all" || scope === "app") {
    checks.push(
      ...checkRequiredDocs(root),
      ...checkPackageScripts(root),
      ...checkHealthRoute(root),
      ...checkEnvLocalIgnored(root),
      ...checkHardcodedSecrets(root),
      ...checkServiceRoleFrontend(root)
    );
    if (build) checks.push(runBuild(root));
  }

  return checks;
}

export function printChecks(checks) {
  const labels = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  for (const check of checks) {
    console.log(`[${labels[check.status]}] ${check.name}: ${check.detail}`);
  }
  const summary = {
    pass: checks.filter((check) => check.status === "pass").length,
    warn: checks.filter((check) => check.status === "warn").length,
    fail: checks.filter((check) => check.status === "fail").length
  };
  console.log(`\nSummary: ${summary.pass} passed, ${summary.warn} warning(s), ${summary.fail} failed.`);
  return summary;
}

async function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const scope = process.argv[2] ?? "all";
  const strict = process.env.DEPLOY_STRICT === "true" || process.argv.includes("--strict");
  const build = process.argv.includes("--build");
  const checks = await runChecks({ root, scope, strict, build });
  const summary = printChecks(checks);
  process.exitCode = summary.fail > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
