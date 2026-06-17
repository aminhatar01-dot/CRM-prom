import { NextResponse } from "next/server";
import { webchatHistorySchema } from "@crm-pro-ai/integrations/webchat";
import { createAdminClient } from "@/lib/supabase/admin";
import { webchatCorsHeaders, webchatOptionsResponse } from "@/lib/webchat/cors";
import { checkWebchatRateLimit } from "@/lib/webchat/rate-limit";
import { requestOrigin } from "@/lib/webchat/security";
import {
  loadWebchatHistory,
  loadWidgetForPublicRequest,
  type SupabaseWebchatClient
} from "@/lib/webchat/service";

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const headers = webchatCorsHeaders(origin);
  const url = new URL(request.url);
  const parsed = webchatHistorySchema.safeParse({
    token: url.searchParams.get("token"),
    conversation_id: url.searchParams.get("conversation_id")
  });

  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers });

  if (!checkWebchatRateLimit(`${parsed.data.token}:${parsed.data.conversation_id}:history`, 60)) {
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

  const messages = await loadWebchatHistory(supabase, widgetResult.widget, parsed.data.conversation_id);
  return NextResponse.json({ messages }, { headers });
}

export function OPTIONS(request: Request) {
  return webchatOptionsResponse(request);
}
