import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/automation/cron";
import { runPendingAutomations, type SupabaseLike } from "@/lib/automation/runner";

export async function POST(request: Request) {
  const env = getServerEnv();
  const authorized = isCronAuthorized({
    authorization: request.headers.get("authorization"),
    headerSecret: request.headers.get("x-cron-secret"),
    cronSecret: env.CRON_SECRET
  });

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results = await runPendingAutomations(supabase as unknown as SupabaseLike);

  return NextResponse.json({
    processed: results.length,
    results
  });
}
