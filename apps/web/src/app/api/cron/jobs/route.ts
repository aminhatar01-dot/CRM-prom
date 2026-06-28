import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/automation/cron";
import { processBatch } from "@/lib/jobs/processor";
import "@/lib/jobs/handlers"; // register all handlers

export async function POST(request: Request) {
  const env = getServerEnv();
  const authorized = isCronAuthorized({
    authorization:  request.headers.get("authorization"),
    headerSecret:   request.headers.get("x-cron-secret"),
    cronSecret:     env.CRON_SECRET,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results = await processBatch(supabase, { maxJobs: 20 });

  const summary = {
    processed:   results.length,
    completed:   results.filter((r) => r.status === "completed").length,
    failed:      results.filter((r) => r.status === "failed").length,
    dead_letter: results.filter((r) => r.status === "dead_letter").length,
    no_handler:  results.filter((r) => r.status === "no_handler").length,
  };

  return NextResponse.json(summary);
}
