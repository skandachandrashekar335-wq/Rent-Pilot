import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ReviewPaymentSubmissionSchema } from "@/lib/validation/billing";
import {
  determineInvoiceStatus,
  generateReceiptNumber,
  paiseToRupees,
} from "@/lib/domain/billing";
import {
  sendPaymentVerifiedReceipt,
  sendPaymentRejectedAlert,
} from "@/lib/notifications/brevo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager) {
      return NextResponse.json({ error: "Only owners or managers can review payment submissions" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = ReviewPaymentSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Fetch submission with invoice, tenancy, tenant, and unit details
    const { data: submission, error: subErr } = await supabase
      .from("payment_submissions")
      .select(`
        *,
        invoice:invoices(
          id,
          organization_id,
          invoice_number,
          total_due_paise,
          amount_paid_paise,
          balance_due_paise,
          due_date,
          status
        ),
        tenancy:tenancies(
          id,
          tenant:tenants(id, full_name, email),
          unit:units(unit_number, property:properties(name))
        )
      `)
      .eq("id", submissionId)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (subErr || !submission) {
      return NextResponse.json({ error: "Payment submission not found" }, { status: 404 });
    }

    if (submission.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: `This submission has already been ${submission.status.toLowerCase()}` }, { status: 400 });
    }

    interface SubmissionInvoiceInfo {
      id: string;
      organization_id: string;
      invoice_number: string;
      total_due_paise: number;
      amount_paid_paise: number;
      balance_due_paise: number;
      due_date: string;
      status: string;
    }

    interface SubmissionTenancyInfo {
      id: string;
      tenant?: { id: string; full_name?: string | null; email?: string | null } | null;
      unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
    }

    const invoice = submission.invoice as SubmissionInvoiceInfo;
    const tenancy = submission.tenancy as SubmissionTenancyInfo | null;
    const nowIso = new Date().toISOString();
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const portalUrl = `${protocol}://${host}/portal`;

    // 2. APPROVE ACTION
    if (parsed.data.action === "APPROVE") {
      // Generate receipt number
      const currentYear = new Date().getFullYear();
      const { count: receiptCount } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", auth.organizationId!);

      const receiptNumber = generateReceiptNumber(currentYear, (receiptCount || 0) + 1);

      // Insert immutable payment into ledger
      const { data: paymentRecord, error: payErr } = await supabase
        .from("payments")
        .insert({
          organization_id: auth.organizationId!,
          invoice_id: invoice.id,
          tenancy_id: submission.tenancy_id,
          submission_id: submission.id,
          amount_paise: submission.amount_paise,
          payment_method: "UPI",
          payment_date: new Date().toISOString().split("T")[0]!,
          normalized_reference: submission.normalized_reference,
          receipt_number: receiptNumber,
          recorded_by_profile_id: auth.profileId,
          notes: `Verified UPI UTR: ${submission.normalized_reference}`,
        })
        .select()
        .single();

      if (payErr) {
        return NextResponse.json({ error: payErr.message }, { status: 500 });
      }

      // Mark submission VERIFIED
      await supabase
        .from("payment_submissions")
        .update({
          status: "VERIFIED",
          reviewed_by_profile_id: auth.profileId,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", submission.id);

      // Recalculate invoice from all verified payments
      const { data: allVerifiedPayments } = await supabase
        .from("payments")
        .select("amount_paise")
        .eq("invoice_id", invoice.id);

      const totalPaidPaise = (allVerifiedPayments || []).reduce(
        (sum, p) => sum + BigInt(p.amount_paise),
        BigInt(0)
      );

      const { status: newStatus, isOverdue, balanceDuePaise } = determineInvoiceStatus(
        BigInt(invoice.total_due_paise),
        totalPaidPaise,
        invoice.due_date
      );

      const { data: updatedInvoice } = await supabase
        .from("invoices")
        .update({
          amount_paid_paise: Number(totalPaidPaise),
          balance_due_paise: Number(balanceDuePaise),
          status: newStatus,
          is_overdue: isOverdue,
          updated_at: nowIso,
        })
        .eq("id", invoice.id)
        .select()
        .single();

      // Audit Log
      await supabase.from("financial_audit_logs").insert({
        organization_id: auth.organizationId!,
        entity_type: "PAYMENT",
        entity_id: paymentRecord.id,
        action: "PAYMENT_PROOF_APPROVED",
        actor_profile_id: auth.profileId,
        before_state: { invoice_balance_due_paise: invoice.balance_due_paise },
        after_state: {
          receipt_number: receiptNumber,
          amount_paise: submission.amount_paise,
          invoice_status: newStatus,
          remaining_balance_paise: Number(balanceDuePaise),
        },
      });

      // Brevo Receipt Notification
      if (tenancy?.tenant?.email) {
        sendPaymentVerifiedReceipt({
          tenantEmail: tenancy.tenant.email,
          tenantName: tenancy.tenant.full_name || "Tenant",
          propertyName: tenancy.unit?.property?.name || "Property",
          unitCode: tenancy.unit?.unit_number || "Unit",
          receiptNumber,
          amountPaidRupees: paiseToRupees(submission.amount_paise),
          balanceDueRupees: paiseToRupees(balanceDuePaise),
          paymentMethod: "UPI",
          referenceNumber: submission.normalized_reference,
          portalUrl,
        }).catch((err) => console.error("Brevo receipt warning:", err));
      }

      return NextResponse.json({
        success: true,
        action: "APPROVED",
        message: `Payment of ₹${paiseToRupees(submission.amount_paise).toLocaleString("en-IN")} verified. Receipt ${receiptNumber} generated.`,
        payment: paymentRecord,
        invoice: updatedInvoice,
      });
    }

    // 3. REJECT ACTION
    if (parsed.data.action === "REJECT") {
      // Mark submission REJECTED with reason (Releases the normalized reference lock!)
      await supabase
        .from("payment_submissions")
        .update({
          status: "REJECTED",
          rejection_reason: parsed.data.rejectionReason,
          reviewed_by_profile_id: auth.profileId,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", submission.id);

      // Audit Log
      await supabase.from("financial_audit_logs").insert({
        organization_id: auth.organizationId!,
        entity_type: "PAYMENT_SUBMISSION",
        entity_id: submission.id,
        action: "PAYMENT_PROOF_REJECTED",
        actor_profile_id: auth.profileId,
        after_state: {
          rejection_reason: parsed.data.rejectionReason,
          released_reference: submission.normalized_reference,
        },
      });

      // Brevo Alert Notification
      if (tenancy?.tenant?.email) {
        sendPaymentRejectedAlert({
          tenantEmail: tenancy.tenant.email,
          tenantName: tenancy.tenant.full_name || "Tenant",
          unitCode: tenancy.unit?.unit_number || "Unit",
          rejectionReason: parsed.data.rejectionReason!,
          referenceNumber: submission.normalized_reference,
          portalUrl,
        }).catch((err) => console.error("Brevo reject warning:", err));
      }

      return NextResponse.json({
        success: true,
        action: "REJECTED",
        message: "Payment submission rejected. Reference lock released for tenant resubmission.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
