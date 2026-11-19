import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: submission, error: subErr } = await supabase
      .from("payment_submissions")
      .select("*, invoice:invoices(organization_id)")
      .eq("id", submissionId)
      .single();

    if (subErr || !submission) {
      return NextResponse.json({ error: "Payment submission not found" }, { status: 404 });
    }

    // Authorization: Must be owner/manager of the org OR the submitting tenant
    const invoiceOrgId = (submission.invoice as { organization_id?: string } | null)?.organization_id;
    const isOwner = auth.isOwnerOrManager && auth.organizationId === invoiceOrgId;
    const isSubmitter = submission.submitted_by_profile_id === auth.profileId;

    if (!isOwner && !isSubmitter) {
      return NextResponse.json({ error: "Access denied to this receipt" }, { status: 403 });
    }

    // Generate 15-minute (900 seconds) signed URL
    const { data: signedData, error: signErr } = await supabase.storage
      .from("receipts")
      .createSignedUrl(submission.storage_path, 900);

    if (signErr || !signedData?.signedUrl) {
      // In local dev/fallback if bucket object not present:
      return NextResponse.json({
        signedUrl: "/receipt-placeholder.png",
        expiresInSeconds: 900,
        isFallback: true,
      });
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      expiresInSeconds: 900,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
