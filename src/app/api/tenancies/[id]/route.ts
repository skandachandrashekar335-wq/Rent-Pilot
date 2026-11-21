import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { EndTenancySchema } from "@/lib/validation/rental";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenancyId } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: tenancy, error } = await supabase
      .from("tenancies")
      .select(`
        *,
        tenant:tenants(*),
        unit:units(*, property:properties(*))
      `)
      .eq("id", tenancyId)
      .maybeSingle();

    if (error || !tenancy) {
      return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
    }

    // Role-based authorization & multi-tenant isolation (BOLA / IDOR protection)
    if (auth.isOwnerOrManager) {
      if (tenancy.organization_id !== auth.organizationId) {
        return NextResponse.json({ error: "Access denied: Tenancy belongs to another organization" }, { status: 403 });
      }
    } else {
      const typedTenant = tenancy.tenant as { profile_id?: string | null; email?: string | null } | null;
      if (typedTenant?.profile_id !== auth.profileId && typedTenant?.email !== auth.email) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({ tenancy });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
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
      .maybeSingle();

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
      .eq("id", tenancyId)
      .select()
      .single();

    if (updErr) {
      console.error("[End Tenancy Error]", updErr);
      return NextResponse.json({ error: "Failed to conclude tenancy" }, { status: 500 });
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
      message: "Tenancy concluded successfully",
      tenancy: updatedTenancy,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
