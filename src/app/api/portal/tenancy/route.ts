import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Find tenant record linked to profile or email in a single query
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, full_name, email, phone, profile_id")
      .or(`profile_id.eq.${auth.profileId},email.ilike.${auth.email}`)
      .limit(1)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ activeTenancy: null, isLinked: false });
    }

    if (!tenant.profile_id) {
      // Link profile asynchronously
      await supabase
        .from("tenants")
        .update({ profile_id: auth.profileId, updated_at: new Date().toISOString() })
        .eq("id", tenant.id);
    }

    // 2. Fetch active or upcoming tenancy
    const { data: tenancy, error: tenancyErr } = await supabase
      .from("tenancies")
      .select(`
        *,
        unit:units(
          id,
          unit_number,
          floor_number,
          configuration_label,
          bedrooms,
          bathrooms,
          has_parking,
          facilities,
          base_rent_paise,
          property:properties(
            id,
            name,
            address_line,
            city,
            state,
            pincode,
            facilities
          )
        ),
        rent_increment_schedules:rent_increment_schedules(*)
      `)
      .eq("tenant_id", tenant.id)
      .in("status", ["ACTIVE", "UPCOMING"])
      .order("start_date", { ascending: false })
      .maybeSingle();

    if (tenancyErr) {
      console.error("[Portal Tenancy Fetch Error]", tenancyErr);
      return NextResponse.json({ error: "Failed to fetch tenancy details" }, { status: 500 });
    }

    return NextResponse.json({
      isLinked: true,
      tenant,
      activeTenancy: tenancy || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
