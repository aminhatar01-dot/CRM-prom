import { NextResponse } from "next/server";
import { getHealthStatus } from "../../../lib/system/health";

export async function GET() {
  const health = getHealthStatus();
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: {
      "cache-control": "no-store"
    }
  });
}
