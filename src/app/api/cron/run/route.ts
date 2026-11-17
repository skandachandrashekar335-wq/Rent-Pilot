import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runScheduledMaintenanceAndBilling } from "@/lib/jobs/scheduler";

export const dynamic = "force-dynamic";

function safeTimingCompare(provided: string, expected: string): boolean {
  const bufProvided = Buffer.from(provided);
  const bufExpected = Buffer.from(expected);

  if (bufProvided.length !== bufExpected.length) {
    // Run comparison against self to prevent timing side channels on length
    crypto.timingSafeEqual(bufProvided, bufProvided);
    return false;
  }

  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[Cron Auth Error] CRON_SECRET is not configured in server environment.");
      return NextResponse.json({ error: "Cron execution endpoint is disabled." }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const [bearer, token] = authHeader.split(" ");

    if (bearer !== "Bearer" || !token || !safeTimingCompare(token, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized. Valid Bearer token required." }, { status: 401 });
    }

    // Execute idempotent daily maintenance, overdue reconciliation, and increment alerts
    const result = await runScheduledMaintenanceAndBilling("CRON");

    return NextResponse.json({
      status: "complete",
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error executing cron job";
    console.error("[Cron API Route Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
