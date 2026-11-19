import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { EndTenancySchema } from "@/lib/validation/rental";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenancyId } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager || !auth.organizationId) {
      return NextResponse.json({ error: "Forbidden: Owner or manager permissions required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = EndTenancySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Fetch tenancy
    const { data: tenancy, error: getErr } = await supabase
      .from("tenancies")
      .select("id, unit_id, status")
      .eq("id", tenancyId)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (getErr || !tenancy) {
      return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
    }

    // 2. Update Tenancy Status & End Date (Preserving all history)
    const { data: updatedTenancy, error: updErr } = await supabase
      .from("tenancies")
      .update({
        status: parsed.data.status,
        end_date: parsed.data.endDate,
        termination_reason: parsed.data.terminationReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenancy.id)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // 3. Mark Unit as VACANT
    await supabase
      .from("units")
      .update({
        occupancy_status: "VACANT",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenancy.unit_id);

    return NextResponse.json({
      success: true,
      tenancy: updatedTenancy,
      message: `Tenancy marked as ${parsed.data.status.toLowerCase()}. Unit is now vacant.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
