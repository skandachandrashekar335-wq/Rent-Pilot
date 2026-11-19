import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AdjustInvoiceSchema } from "@/lib/validation/billing";
import { calculateInvoiceTotals, rupeesToPaise } from "@/lib/domain/billing";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager) {
      return NextResponse.json({ error: "Only owners or managers can adjust invoices" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = AdjustInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: invoice, error: fetchErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (fetchErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const adjustmentPaise = rupeesToPaise(parsed.data.amountRupees);
    let newCreditsPaise = BigInt(invoice.credits_paise);
    let newOtherChargesPaise = BigInt(invoice.other_charges_paise);

    if (parsed.data.adjustmentType === "CREDIT") {
      newCreditsPaise += adjustmentPaise;
    } else {
      newOtherChargesPaise += adjustmentPaise;
    }

    const { totalDuePaise, balanceDuePaise } = calculateInvoiceTotals(
      {
        rentPaise: BigInt(invoice.rent_paise),
        electricityPaise: BigInt(invoice.electricity_paise),
        waterPaise: BigInt(invoice.water_paise),
        maintenancePaise: BigInt(invoice.maintenance_paise),
        otherChargesPaise: newOtherChargesPaise,
        previousBalancePaise: BigInt(invoice.previous_balance_paise),
        creditsPaise: newCreditsPaise,
      },
      BigInt(invoice.amount_paid_paise)
    );

    // Update invoice
    const { data: updatedInvoice, error: updateErr } = await supabase
      .from("invoices")
      .update({
        credits_paise: Number(newCreditsPaise),
        other_charges_paise: Number(newOtherChargesPaise),
        total_due_paise: Number(totalDuePaise),
        balance_due_paise: Number(balanceDuePaise),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Insert line item
    await supabase.from("invoice_items").insert({
      organization_id: auth.organizationId!,
      invoice_id: invoice.id,
      item_type: parsed.data.adjustmentType === "CREDIT" ? "CREDIT" : "ADJUSTMENT",
      label: `Adjustment: ${parsed.data.reason}`,
      amount_paise: parsed.data.adjustmentType === "CREDIT" ? -Number(adjustmentPaise) : Number(adjustmentPaise),
    });

    // Write audit log
    await supabase.from("financial_audit_logs").insert({
      organization_id: auth.organizationId!,
      entity_type: "INVOICE",
      entity_id: invoice.id,
      action: "INVOICE_ADJUSTED",
      actor_profile_id: auth.profileId,
      before_state: { total_due_paise: invoice.total_due_paise, balance_due_paise: invoice.balance_due_paise },
      after_state: { total_due_paise: Number(totalDuePaise), balance_due_paise: Number(balanceDuePaise), reason: parsed.data.reason },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice successfully adjusted.",
      invoice: updatedInvoice,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
