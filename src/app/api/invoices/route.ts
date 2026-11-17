import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { determineInvoiceStatus } from "@/lib/domain/billing";

export async function GET(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const yearFilter = searchParams.get("year");
    const monthFilter = searchParams.get("month");

    const supabase = createAdminSupabaseClient();

    let query = supabase
      .from("invoices")
      .select(`
        *,
        tenancy:tenancies(
          id,
          tenant:tenants(id, full_name, email, phone),
          unit:units(
            id,
            unit_number,
            configuration_label,
            property:properties(id, name)
          )
        ),
        payment_submissions(id, status, amount_paise, normalized_reference, created_at),
        payments(id, amount_paise, payment_method, receipt_number, payment_date)
      `)
      .order("created_at", { ascending: false });

    if (auth.isOwnerOrManager && auth.organizationId) {
      query = query.eq("organization_id", auth.organizationId);
    } else {
      // Tenant: find tenancies belonging to this tenant profile
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("profile_id", auth.profileId)
        .maybeSingle();

      if (!tenant) {
        return NextResponse.json({ invoices: [] });
      }

      query = query
        .neq("status", "DRAFT")
        .eq("tenancy.tenant_id", tenant.id);
    }

    if (yearFilter) query = query.eq("billing_period_year", Number(yearFilter));
    if (monthFilter) query = query.eq("billing_period_month", Number(monthFilter));
    if (statusFilter && statusFilter !== "ALL") query = query.eq("status", statusFilter);

    const { data: invoices, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Dynamic overdue evaluation
    const now = new Date();
    const evaluatedInvoices = (invoices || []).map((inv) => {
      const { status, isOverdue } = determineInvoiceStatus(
        BigInt(inv.total_due_paise),
        BigInt(inv.amount_paid_paise),
        inv.due_date,
        now
      );

      // If draft or cancelled, do not mutate status
      const effectiveStatus = inv.status === "DRAFT" || inv.status === "CANCELLED" ? inv.status : status;

      return {
        ...inv,
        status: effectiveStatus,
        is_overdue: isOverdue && inv.status !== "DRAFT" && inv.status !== "CANCELLED",
        has_pending_proof: ((inv.payment_submissions as Array<{ status: string }> | null) || []).some((s) => s.status === "PENDING_REVIEW"),
      };
    });

    return NextResponse.json({ invoices: evaluatedInvoices });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
