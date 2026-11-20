import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreatePropertySchema } from "@/lib/validation/rental";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { auth, errorResponse } = await requireOwnerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const orgId = auth.organizationId;
    if (!orgId) {
      return NextResponse.json({ properties: [] });
    }

    const supabase = createAdminSupabaseClient();
    const { data: properties, error } = await supabase
      .from("properties")
      .select(`
        *,
        units:units(
          id,
          unit_number,
          floor_number,
          configuration_label,
          bedrooms,
          bathrooms,
          has_parking,
          facilities,
          base_rent_paise,
          security_deposit_paise,
          occupancy_status,
          is_archived
        )
      `)
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Properties GET Error]", error);
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
    }

    return NextResponse.json({ properties: properties || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await requireOwnerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager || !auth.organizationId) {
      return NextResponse.json({ error: "Forbidden: Owner or manager permissions required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreatePropertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const orgId = auth.organizationId;

    const supabase = createAdminSupabaseClient();
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        organization_id: orgId,
        name: parsed.data.name,
        property_type: parsed.data.propertyType,
        address_line: parsed.data.addressLine,
        city: parsed.data.city,
        state: parsed.data.state,
        pincode: parsed.data.pincode,
        total_floors: parsed.data.totalFloors,
        facilities: parsed.data.facilities,
        notes: parsed.data.notes,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ property }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
