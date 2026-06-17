import { NextResponse } from "next/server";
import { webchatStartSchema } from "@crm-pro-ai/integrations/webchat";
import { createAdminClient } from "@/lib/supabase/admin";
import { webchatCorsHeaders, webchatOptionsResponse } from "@/lib/webchat/cors";
import { checkWebchatRateLimit } from "@/lib/webchat/rate-limit";
import { requestOrigin } from "@/lib/webchat/security";
import {
  loadWidgetForPublicRequest,
  startWebchatConversation,
  type SupabaseWebchatClient
} from "@/lib/webchat/service";

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const headers = webchatCorsHeaders(origin);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  const parsed = webchatStartSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers });

  if (!checkWebchatRateLimit(`${parsed.data.token}:${ip}:start`, 12)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers });
  }

  const supabase = createAdminClient() as unknown as SupabaseWebchatClient;
  const widgetResult = await loadWidgetForPublicRequest(supabase, parsed.data.token, origin);
  if (!widgetResult.ok) {
    return NextResponse.json(
      { error: widgetResult.reason },
      { status: widgetResult.reason === "domain_not_allowed" ? 403 : 401, headers },
    );
  }

  const response = await startWebchatConversation({
    supabase,
    widget: widgetResult.widget,
    input: parsed.data,
    origin
  });

  return NextResponse.json(response, { headers });
}

export function OPTIONS(request: Request) {
  return webchatOptionsResponse(request);
}
