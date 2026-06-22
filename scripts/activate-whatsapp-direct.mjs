import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const env = {
  ...loadEnv(resolve(root, ".env.local")),
  ...loadEnv(resolve(root, "apps/web/.env.local")),
  ...process.env
};

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WHATSAPP_PHONE_NUMBER_ID",
  "DISPLAY_PHONE_NUMBER"
];
const missing = required.filter((name) => !env[name]);

if (missing.length > 0) {
  throw new Error(`Missing required variables: ${missing.join(", ")}`);
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const organization = await resolveOrganization();
await assertPhoneNumberIsTenantSafe(organization.id);

const { error: disableError } = await supabase
  .from("whatsapp_channel_settings")
  .update({ enabled: false })
  .eq("organization_id", organization.id)
  .neq("phone_number_id", env.WHATSAPP_PHONE_NUMBER_ID);

if (disableError) {
  throw new Error(`Could not disable previous WhatsApp channels: ${disableError.message}`);
}

const { data: setting, error: upsertError } = await supabase
  .from("whatsapp_channel_settings")
  .upsert(
    {
      organization_id: organization.id,
      phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID,
      display_phone_number: env.DISPLAY_PHONE_NUMBER,
      webhook_verify_token_hint: "configured-in-vercel",
      enabled: true,
      connection_method: "manual",
      token_status: "active",
      connected_at: new Date().toISOString()
    },
    { onConflict: "organization_id,phone_number_id" }
  )
  .select(
    "id, organization_id, phone_number_id, display_phone_number, enabled, connection_method, token_status"
  )
  .single();

if (upsertError || !setting) {
  throw new Error(`Could not activate the WhatsApp channel: ${upsertError?.message ?? "No row returned"}`);
}

console.log(`Organization: ${organization.name} (${organization.slug})`);
console.log(`Channel setting: ${setting.id}`);
console.log(`Phone Number ID: ${mask(setting.phone_number_id)}`);
console.log(`Display phone: ${maskPhone(setting.display_phone_number)}`);
console.log(`Connection method: ${setting.connection_method}`);
console.log(`Enabled: ${setting.enabled}`);
console.log(`Token status: ${setting.token_status}`);
console.log("Access token storage: Vercel server-side environment only");

async function resolveOrganization() {
  if (env.WHATSAPP_ORGANIZATION_ID) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", env.WHATSAPP_ORGANIZATION_ID)
      .single();

    if (error || !data) {
      throw new Error("WHATSAPP_ORGANIZATION_ID does not identify an accessible organization.");
    }

    return data;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name, slug)")
    .eq("role", "owner");

  if (error) {
    throw new Error(`Could not resolve the owner organization: ${error.message}`);
  }

  const organizations = (data ?? [])
    .map((membership) => membership.organizations)
    .flat()
    .filter(Boolean);
  const unique = [
    ...new Map(organizations.map((organization) => [organization.id, organization])).values()
  ];

  if (unique.length !== 1) {
    throw new Error(
      `Expected one owner organization, found ${unique.length}. Set WHATSAPP_ORGANIZATION_ID explicitly.`
    );
  }

  return unique[0];
}

async function assertPhoneNumberIsTenantSafe(organizationId) {
  const { data, error } = await supabase
    .from("whatsapp_channel_settings")
    .select("organization_id")
    .eq("phone_number_id", env.WHATSAPP_PHONE_NUMBER_ID);

  if (error) {
    throw new Error(`Could not validate Phone Number ID ownership: ${error.message}`);
  }

  const crossTenant = (data ?? []).some((row) => row.organization_id !== organizationId);
  if (crossTenant) {
    throw new Error("Phone Number ID is already registered by another organization.");
  }
}

function loadEnv(file) {
  if (!existsSync(file)) return {};

  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      })
  );
}

function mask(value) {
  if (!value || value.length < 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function maskPhone(value) {
  if (!value) return "***";
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}
