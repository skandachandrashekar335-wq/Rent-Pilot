import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { UpdateUnitSchema } from "@/lib/validation/rental";
import { rupeesToPaise } from "@/lib/domain/rent-increments";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = UpdateUnitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.unitNumber !== undefined) updatePayload.unit_number = parsed.data.unitNumber;
    if (parsed.data.floorNumber !== undefined) updatePayload.floor_number = parsed.data.floorNumber;
    if (parsed.data.configurationLabel !== undefined) updatePayload.configuration_label = parsed.data.configurationLabel;
    if (parsed.data.bedrooms !== undefined) updatePayload.bedrooms = parsed.data.bedrooms;
    if (parsed.data.bathrooms !== undefined) updatePayload.bathrooms = parsed.data.bathrooms;
    if (parsed.data.hasParking !== undefined) updatePayload.has_parking = parsed.data.hasParking;
    if (parsed.data.facilities !== undefined) updatePayload.facilities = parsed.data.facilities;
    if (parsed.data.occupancyStatus !== undefined) updatePayload.occupancy_status = parsed.data.occupancyStatus;

    if (parsed.data.baseRentRupees !== undefined) {
      updatePayload.base_rent_paise = Number(rupeesToPaise(parsed.data.baseRentRupees));
    }
    if (parsed.data.securityDepositRupees !== undefined) {
      updatePayload.security_deposit_paise = Number(rupeesToPaise(parsed.data.securityDepositRupees));
    }

    const { data: unit, error } = await supabase
      .from("units")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", auth.organizationId!)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unit });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from("units")
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", auth.organizationId!);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Unit archived successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
