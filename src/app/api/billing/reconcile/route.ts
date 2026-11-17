import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { runScheduledMaintenanceAndBilling } from "@/lib/jobs/scheduler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.organizationId) {
      return NextResponse.json({ error: "Active organization required." }, { status: 400 });
    }

    // Run demand-driven reconciliation for the authenticated owner's organization
    const result = await runScheduledMaintenanceAndBilling("DASHBOARD_RECOVERY", auth.organizationId);

    return NextResponse.json({
      status: "complete",
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error running billing reconciliation";
    console.error("[Billing Reconcile API Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
