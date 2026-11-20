import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { UpdatePropertySchema } from "@/lib/validation/rental";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth, errorResponse } = await requireOwnerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: property, error } = await supabase
      .from("properties")
      .select(`
        *,
        units:units(
          *,
          tenancies:tenancies(
            *,
            tenant:tenants(*)
          )
        )
      `)
      .eq("id", id)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (error || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    return NextResponse.json({ property });
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
    const { id } = await params;
    const { auth, errorResponse } = await requireOwnerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = UpdatePropertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.propertyType !== undefined) updatePayload.property_type = parsed.data.propertyType;
    if (parsed.data.addressLine !== undefined) updatePayload.address_line = parsed.data.addressLine;
    if (parsed.data.city !== undefined) updatePayload.city = parsed.data.city;
    if (parsed.data.state !== undefined) updatePayload.state = parsed.data.state;
    if (parsed.data.pincode !== undefined) updatePayload.pincode = parsed.data.pincode;
    if (parsed.data.totalFloors !== undefined) updatePayload.total_floors = parsed.data.totalFloors;
    if (parsed.data.facilities !== undefined) updatePayload.facilities = parsed.data.facilities;
    if (parsed.data.notes !== undefined) updatePayload.notes = parsed.data.notes;

    const { data: property, error } = await supabase
      .from("properties")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", auth.organizationId!)
      .select()
      .single();

    if (error) {
      console.error("[Property Update Error]", error);
      return NextResponse.json({ error: "Failed to update property" }, { status: 500 });
    }

    return NextResponse.json({ property });
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
    const { auth, errorResponse } = await requireOwnerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();

    // Verify property exists and check for occupied units
    const { data: units, error: unitsErr } = await supabase
      .from("units")
      .select("id, occupancy_status, unit_number")
      .eq("property_id", id)
      .eq("organization_id", auth.organizationId!);

    if (unitsErr) {
      console.error("[Property Units Fetch Error]", unitsErr);
      return NextResponse.json({ error: "Failed to verify property units" }, { status: 500 });
    }

    const occupiedUnits = (units || []).filter((u) => u.occupancy_status === "OCCUPIED");
    if (occupiedUnits.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete property with occupied units (${occupiedUnits.map((u) => u.unit_number).join(", ")}). End active tenancies first.`,
        },
        { status: 400 }
      );
    }

    // Delete any vacant units first
    if (units && units.length > 0) {
      const unitIds = units.map((u) => u.id);
      await supabase
        .from("units")
        .delete()
        .in("id", unitIds)
        .eq("organization_id", auth.organizationId!);
    }

    // Delete property
    const { error: delErr } = await supabase
      .from("properties")
      .delete()
      .eq("id", id)
      .eq("organization_id", auth.organizationId!);

    if (delErr) {
      // Historical references exist - soft-archive
      const { error: archiveErr } = await supabase
        .from("properties")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", auth.organizationId!);

      if (archiveErr) {
        console.error("[Property Archive Error]", archiveErr);
        return NextResponse.json({ error: "Failed to delete property" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Property deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
