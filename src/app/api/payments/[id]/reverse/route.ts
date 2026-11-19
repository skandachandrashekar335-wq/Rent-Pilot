import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  determineInvoiceStatus,
  generateReceiptNumber,
} from "@/lib/domain/billing";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentId } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager) {
      return NextResponse.json({ error: "Only owners or managers can reverse payments" }, { status: 403 });
    }

    const body = await req.json();
    const reason = body.reason?.trim() || "Administrative payment reversal";

    const supabase = createAdminSupabaseClient();

    // 1. Fetch original payment
    const { data: originalPayment, error: payErr } = await supabase
      .from("payments")
      .select("*, invoice:invoices(*)")
      .eq("id", paymentId)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (payErr || !originalPayment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    if (originalPayment.payment_method === "REVERSAL") {
      return NextResponse.json({ error: "Cannot reverse an existing reversal transaction" }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    const { count: receiptCount } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId!);

    const reversalReceiptNumber = generateReceiptNumber(currentYear, (receiptCount || 0) + 1);

    // 2. Insert immutable REVERSAL transaction into payments ledger (negative paise)
    const { data: reversalRecord, error: revErr } = await supabase
      .from("payments")
      .insert({
        organization_id: auth.organizationId!,
        invoice_id: originalPayment.invoice_id,
        tenancy_id: originalPayment.tenancy_id,
        amount_paise: -Number(originalPayment.amount_paise),
        payment_method: "REVERSAL",
        payment_date: new Date().toISOString().split("T")[0]!,
        normalized_reference: `REV-${originalPayment.receipt_number}`,
        receipt_number: reversalReceiptNumber,
        recorded_by_profile_id: auth.profileId,
        notes: `Reversal of ${originalPayment.receipt_number}: ${reason}`,
      })
      .select()
      .single();

    if (revErr) {
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }

    // 3. Recalculate invoice from all verified payments
    const { data: allPayments } = await supabase
      .from("payments")
      .select("amount_paise")
      .eq("invoice_id", originalPayment.invoice_id);

    const totalPaidPaise = (allPayments || []).reduce(
      (sum, p) => sum + BigInt(p.amount_paise),
      BigInt(0)
    );

    const invoice = originalPayment.invoice as { id: string; total_due_paise: number; due_date: string };
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id)
      .select()
      .single();

    // 4. Audit Log
    await supabase.from("financial_audit_logs").insert({
      organization_id: auth.organizationId!,
      entity_type: "PAYMENT",
      entity_id: reversalRecord.id,
      action: "PAYMENT_REVERSED",
      actor_profile_id: auth.profileId,
      before_state: {
        original_payment_id: originalPayment.id,
        original_receipt_number: originalPayment.receipt_number,
      },
      after_state: {
        reversal_receipt_number: reversalReceiptNumber,
        reason,
        new_balance_due_paise: Number(balanceDuePaise),
        new_invoice_status: newStatus,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payment ${originalPayment.receipt_number} reversed. Reversal ID: ${reversalReceiptNumber}.`,
      reversal: reversalRecord,
      invoice: updatedInvoice,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
