import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { RecordOfflinePaymentSchema } from "@/lib/validation/billing";
import {
  determineInvoiceStatus,
  generateReceiptNumber,
  rupeesToPaise,
  paiseToRupees,
} from "@/lib/domain/billing";
import { sendPaymentVerifiedReceipt } from "@/lib/notifications/brevo";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager) {
      return NextResponse.json({ error: "Only owners or managers can record offline payments" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = RecordOfflinePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Fetch invoice and tenancy details
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select(`
        *,
        tenancy:tenancies(
          id,
          tenant:tenants(id, full_name, email),
          unit:units(unit_number, property:properties(name))
        )
      `)
      .eq("id", parsed.data.invoiceId)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const amountPaise = rupeesToPaise(parsed.data.amountRupees);
    const currentYear = new Date().getFullYear();

    // Generate receipt number
    const { count: receiptCount } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId!);

    const receiptNumber = generateReceiptNumber(currentYear, (receiptCount || 0) + 1);

    // 2. Insert into immutable payments ledger
    const { data: paymentRecord, error: payErr } = await supabase
      .from("payments")
      .insert({
        organization_id: auth.organizationId!,
        invoice_id: invoice.id,
        tenancy_id: invoice.tenancy_id,
        amount_paise: Number(amountPaise),
        payment_method: parsed.data.paymentMethod,
        payment_date: parsed.data.paymentDate,
        normalized_reference: parsed.data.referenceNumber ? parsed.data.referenceNumber.trim().toUpperCase() : null,
        receipt_number: receiptNumber,
        recorded_by_profile_id: auth.profileId,
        notes: parsed.data.notes || null,
      })
      .select()
      .single();

    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 500 });
    }

    // 3. Recalculate invoice from all verified payments
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id)
      .select()
      .single();

    // 4. Audit Log
    await supabase.from("financial_audit_logs").insert({
      organization_id: auth.organizationId!,
      entity_type: "PAYMENT",
      entity_id: paymentRecord.id,
      action: "OFFLINE_PAYMENT_RECORDED",
      actor_profile_id: auth.profileId,
      before_state: { balance_due_paise: invoice.balance_due_paise },
      after_state: {
        receipt_number: receiptNumber,
        method: parsed.data.paymentMethod,
        amount_paise: Number(amountPaise),
        new_balance_due_paise: Number(balanceDuePaise),
      },
    });

    // 5. Brevo Receipt Notification
    interface OfflineTenancyInfo {
      tenant?: { full_name?: string | null; email?: string | null } | null;
      unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
    }
    const tenancy = invoice.tenancy as OfflineTenancyInfo | null;
    if (tenancy?.tenant?.email) {
      const host = req.headers.get("host") || "localhost:3000";
      const protocol = host.includes("localhost") ? "http" : "https";
      const portalUrl = `${protocol}://${host}/portal/history`;

      sendPaymentVerifiedReceipt({
        tenantEmail: tenancy.tenant.email,
        tenantName: tenancy.tenant.full_name || "Tenant",
        propertyName: tenancy.unit?.property?.name || "Rental Property",
        unitCode: tenancy.unit?.unit_number || "Unit",
        receiptNumber,
        amountPaidRupees: parsed.data.amountRupees,
        balanceDueRupees: paiseToRupees(balanceDuePaise),
        paymentMethod: parsed.data.paymentMethod,
        referenceNumber: parsed.data.referenceNumber || undefined,
        portalUrl,
      }).catch((err) => console.error("Brevo receipt warning:", err));
    }

    return NextResponse.json({
      success: true,
      message: `Offline payment of ₹${parsed.data.amountRupees.toLocaleString("en-IN")} recorded. Receipt: ${receiptNumber}.`,
      payment: paymentRecord,
      invoice: updatedInvoice,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
