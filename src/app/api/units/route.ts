import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateUnitSchema } from "@/lib/validation/rental";
import { rupeesToPaise } from "@/lib/domain/rent-increments";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager || !auth.organizationId) {
      return NextResponse.json({ error: "Forbidden: Owner or manager permissions required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateUnitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const orgId = auth.organizationId;
    const supabase = createAdminSupabaseClient();

    // Verify property belongs to the organization
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("id", parsed.data.propertyId)
      .eq("organization_id", orgId)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found in your organization" }, { status: 404 });
    }

    const baseRentPaise = rupeesToPaise(parsed.data.baseRentRupees);
    const securityDepositPaise = rupeesToPaise(parsed.data.securityDepositRupees);

    const { data: unit, error } = await supabase
      .from("units")
      .insert({
        organization_id: orgId,
        property_id: parsed.data.propertyId,
        unit_number: parsed.data.unitNumber,
        floor_number: parsed.data.floorNumber,
        configuration_label: parsed.data.configurationLabel,
        bedrooms: parsed.data.bedrooms,
        bathrooms: parsed.data.bathrooms,
        has_parking: parsed.data.hasParking,
        facilities: parsed.data.facilities,
        base_rent_paise: Number(baseRentPaise),
        security_deposit_paise: Number(securityDepositPaise),
        occupancy_status: parsed.data.occupancyStatus,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Unit '${parsed.data.unitNumber}' already exists in this property.` }, { status: 409 });
      }
      console.error("[Unit Creation Error]", error);
      return NextResponse.json({ error: "Failed to create unit" }, { status: 500 });
    }

    return NextResponse.json({ unit }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
