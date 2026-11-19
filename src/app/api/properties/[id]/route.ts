import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { UpdatePropertySchema } from "@/lib/validation/rental";

export const dynamic = "force-dynamic";

export async function GET(
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
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager || !auth.organizationId) {
      return NextResponse.json({ error: "Forbidden: Owner or manager permissions required" }, { status: 403 });
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
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager || !auth.organizationId) {
      return NextResponse.json({ error: "Forbidden: Owner or manager permissions required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    // Soft archive property
    const { error } = await supabase
      .from("properties")
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", auth.organizationId!);

    if (error) {
      console.error("[Property Archive Error]", error);
      return NextResponse.json({ error: "Failed to archive property" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Property archived successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
