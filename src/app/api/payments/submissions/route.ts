import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { SubmitPaymentProofSchema } from "@/lib/validation/billing";
import { rupeesToPaise } from "@/lib/domain/billing";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = SubmitPaymentProofSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Verify invoice exists and fetch tenancy info for authorization
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select(`
        id,
        organization_id,
        tenancy_id,
        total_due_paise,
        balance_due_paise,
        status,
        tenancy:tenancies(
          id,
          tenant:tenants(profile_id)
        )
      `)
      .eq("id", parsed.data.invoiceId)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return NextResponse.json({ error: `Cannot submit payment for an invoice that is already ${invoice.status.toLowerCase()}` }, { status: 400 });
    }

    // Role check: Tenant can only submit for their own tenancy's invoice
    if (!auth.isOwnerOrManager) {
      const typedTenancy = invoice.tenancy as { tenant?: { profile_id?: string | null } | null } | null;
      if (typedTenancy?.tenant?.profile_id !== auth.profileId) {
        return NextResponse.json({ error: "Access denied: You can only submit payment proofs for your own tenancy invoices" }, { status: 403 });
      }
    }

    const orgId = invoice.organization_id;
    const tenancyId = invoice.tenancy_id;
    const amountPaise = rupeesToPaise(parsed.data.amountRupees);

    // Insert payment submission (Protected by partial unique index on (organization_id, normalized_reference))
    const { data: submission, error: subErr } = await supabase
      .from("payment_submissions")
      .insert({
        organization_id: orgId,
        invoice_id: invoice.id,
        tenancy_id: tenancyId,
        submitted_by_profile_id: auth.profileId,
        amount_paise: Number(amountPaise),
        payment_method: "UPI",
        raw_reference: parsed.data.rawReference,
        normalized_reference: parsed.data.normalizedReference,
        storage_path: parsed.data.storagePath,
        status: "PENDING_REVIEW",
      })
      .select()
      .single();

    if (subErr) {
      // PostgreSQL 23505 = unique_violation (Partial unique index collision)
      if (subErr.code === "23505" || subErr.message.includes("idx_unique_active_payment_ref")) {
        return NextResponse.json(
          {
            error: `Transaction reference '${parsed.data.normalizedReference}' has already been submitted and is currently pending review or verified. Duplicate claims are not permitted.`,
            code: "DUPLICATE_ACTIVE_PAYMENT_REF",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    // Write audit log
    await supabase.from("financial_audit_logs").insert({
      organization_id: orgId,
      entity_type: "PAYMENT_SUBMISSION",
      entity_id: submission.id,
      action: "PAYMENT_PROOF_SUBMITTED",
      actor_profile_id: auth.profileId,
      after_state: {
        invoice_id: invoice.id,
        amount_paise: Number(amountPaise),
        normalized_reference: parsed.data.normalizedReference,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Payment proof submitted successfully. Your landlord has been notified for verification.",
        submission,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
