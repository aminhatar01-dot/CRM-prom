type HeaderReader = {
  get(name: string): string | null;
};

const otpTypes = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

export function getRequestOrigin(headers: HeaderReader, env: NodeJS.ProcessEnv = process.env) {
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const forwardedProtocol = firstHeaderValue(headers.get("x-forwarded-proto"));

  if (forwardedHost) {
    return `${forwardedProtocol || "https"}://${forwardedHost}`;
  }

  const host = firstHeaderValue(headers.get("host"));
  if (host) {
    const protocol = forwardedProtocol || (env.NODE_ENV === "production" ? "https" : "http");
    return `${protocol}://${host}`;
  }

  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

export function isSupportedOtpType(value: string | null) {
  return value !== null && otpTypes.has(value);
}

export function postAuthPath(hasOrganization: boolean) {
  return hasOrganization ? "/dashboard" : "/onboarding";
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}
