import { isAllowedWebchatOrigin, isLocalDemoOrigin } from "@crm-pro-ai/integrations/webchat";

export function requestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) return origin;

  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function canUseWidgetFromOrigin({
  origin,
  allowedDomains,
  demoMode = true
}: {
  origin: string | null;
  allowedDomains: string[];
  demoMode?: boolean;
}) {
  if (isAllowedWebchatOrigin(origin, allowedDomains)) return true;
  return demoMode && isLocalDemoOrigin(origin);
}
