import { NextRequest, NextResponse } from "next/server";
import { runScheduledMaintenanceAndBilling } from "@/lib/jobs/scheduler";
import { timingSafeStringEqual } from "@/lib/security/signatures";
import { safeError } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      safeError("[Cron Auth Error] CRON_SECRET is not configured in server environment.");
      return NextResponse.json({ error: "Cron execution endpoint is disabled." }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const [bearer, token] = authHeader.split(" ");

    if (bearer !== "Bearer" || !token || !timingSafeStringEqual(token, cronSecret)) {
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
    safeError("[Cron API Route Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
