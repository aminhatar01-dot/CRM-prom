import { NextResponse } from "next/server";
import { webchatMessageSchema } from "@crm-pro-ai/integrations/webchat";
import { createAdminClient } from "@/lib/supabase/admin";
import { webchatCorsHeaders, webchatOptionsResponse } from "@/lib/webchat/cors";
import { checkWebchatRateLimit } from "@/lib/webchat/rate-limit";
import { requestOrigin } from "@/lib/webchat/security";
import {
  appendWebchatMessage,
  loadWidgetForPublicRequest,
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

  const parsed = webchatMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers });

  if (!checkWebchatRateLimit(`${parsed.data.token}:${ip}:message`, 30)) {
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

  try {
    const message = await appendWebchatMessage({
      supabase,
      widget: widgetResult.widget,
      input: parsed.data
    });

    return NextResponse.json({ message }, { headers });
  } catch {
    return NextResponse.json({ error: "Unable to save message" }, { status: 404, headers });
  }
}

export function OPTIONS(request: Request) {
  return webchatOptionsResponse(request);
}
