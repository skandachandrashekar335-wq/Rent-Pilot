import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { determineInvoiceStatus, paiseToRupees } from "@/lib/domain/billing";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_items(*),
        tenancy:tenancies(
          id,
          tenant:tenants(*),
          unit:units(
            *,
            property:properties(*)
          )
        ),
        payment_submissions(
          *,
          submitted_by:profiles(full_name, email)
        ),
        payments(
          *,
          recorded_by:profiles(full_name, email)
        )
      `)
      .eq("id", id)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Role-based authorization & multi-tenant isolation
    if (auth.isOwnerOrManager) {
      if (invoice.organization_id !== auth.organizationId) {
        return NextResponse.json({ error: "Access denied: Invoice belongs to another organization" }, { status: 403 });
      }
    } else {
      const typedTenancy = invoice.tenancy as { tenant?: { profile_id?: string | null } | null } | null;
      const tenantProfileId = typedTenancy?.tenant?.profile_id;
      if (tenantProfileId !== auth.profileId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (invoice.status === "DRAFT") {
        return NextResponse.json({ error: "Invoice not yet issued" }, { status: 404 });
      }
    }

    const { status, isOverdue } = determineInvoiceStatus(
      BigInt(invoice.total_due_paise),
      BigInt(invoice.amount_paid_paise),
      invoice.due_date
    );

    return NextResponse.json({
      invoice: {
        ...invoice,
        status: invoice.status === "DRAFT" || invoice.status === "CANCELLED" ? invoice.status : status,
        is_overdue: isOverdue && invoice.status !== "DRAFT" && invoice.status !== "CANCELLED",
        totalDueRupees: paiseToRupees(invoice.total_due_paise),
        balanceDueRupees: paiseToRupees(invoice.balance_due_paise),
        amountPaidRupees: paiseToRupees(invoice.amount_paid_paise),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
