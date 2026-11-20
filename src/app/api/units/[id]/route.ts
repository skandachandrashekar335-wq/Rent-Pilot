import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { EditUnitRentSchema } from "@/lib/validation/rental";
import { rupeesToPaise } from "@/lib/domain/rent-increments";

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
    const { data: unit, error } = await supabase
      .from("units")
      .select("*, property:properties(id, name, address_line, city)")
      .eq("id", id)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (error || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    return NextResponse.json({ unit });
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
    const parsed = EditUnitRentSchema.safeParse(body);
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
    if (parsed.data.hasParking !== undefined) updatePayload.has_parking = parsed.data.hasParking;
    if (parsed.data.facilities !== undefined) updatePayload.facilities = parsed.data.facilities;
    if (parsed.data.occupancyStatus !== undefined) updatePayload.occupancy_status = parsed.data.occupancyStatus;

    // Convert rent to paise
    let baseRentPaise: number | undefined;
    if (parsed.data.baseRentPaise !== undefined) {
      baseRentPaise = parsed.data.baseRentPaise;
    } else if (parsed.data.baseRentRupees !== undefined) {
      baseRentPaise = Number(rupeesToPaise(parsed.data.baseRentRupees));
    }

    if (baseRentPaise !== undefined) {
      updatePayload.base_rent_paise = baseRentPaise;
    }

    // Convert deposit to paise
    let depositPaise: number | undefined;
    if (parsed.data.securityDepositPaise !== undefined) {
      depositPaise = parsed.data.securityDepositPaise;
    } else if (parsed.data.securityDepositRupees !== undefined) {
      depositPaise = Number(rupeesToPaise(parsed.data.securityDepositRupees));
    }

    if (depositPaise !== undefined) {
      updatePayload.security_deposit_paise = depositPaise;
    }

    const { data: unit, error } = await supabase
      .from("units")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", auth.organizationId!)
      .select()
      .single();

    if (error) {
      console.error("[Unit Update Error]", error);
      return NextResponse.json({ error: "Failed to update unit" }, { status: 500 });
    }

    // If applyToActiveTenancy is requested, also update the active tenancy lease
    let updatedTenancy = null;
    if (parsed.data.applyToActiveTenancy) {
      const { data: activeTenancy } = await supabase
        .from("tenancies")
        .select("id, status")
        .eq("unit_id", id)
        .eq("organization_id", auth.organizationId!)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (activeTenancy) {
        const tenancyUpdate: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (baseRentPaise !== undefined) {
          tenancyUpdate.monthly_rent_paise = baseRentPaise;
        }
        if (depositPaise !== undefined) {
          tenancyUpdate.security_deposit_paise = depositPaise;
        }

        const { data: tData, error: tErr } = await supabase
          .from("tenancies")
          .update(tenancyUpdate)
          .eq("id", activeTenancy.id)
          .select()
          .single();

        if (tErr) {
          console.warn("[Unit Tenancy Update Warning]", tErr);
        } else {
          updatedTenancy = tData;
        }
      }
    }

    return NextResponse.json({
      unit,
      updatedTenancy,
      message: "Unit rent and specifications updated successfully",
    });
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

    // Check unit occupancy status
    const { data: unit, error: fetchErr } = await supabase
      .from("units")
      .select("id, occupancy_status, unit_number")
      .eq("id", id)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (fetchErr || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (unit.occupancy_status === "OCCUPIED") {
      return NextResponse.json(
        { error: `Cannot delete unit ${unit.unit_number} while occupied. End or terminate active tenancy first.` },
        { status: 400 }
      );
    }

    // Check for open/unpaid invoices
    const { data: openInvoices } = await supabase
      .from("invoices")
      .select("id, status")
      .eq("unit_id", id)
      .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])
      .limit(1);

    if (openInvoices && openInvoices.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete unit ${unit.unit_number} with outstanding invoices.` },
        { status: 400 }
      );
    }

    // Try hard delete first, fallback to archive if historical records reference it
    const { error: delErr } = await supabase
      .from("units")
      .delete()
      .eq("id", id)
      .eq("organization_id", auth.organizationId!);

    if (delErr) {
      // Historical references exist - soft-archive
      const { error: archiveErr } = await supabase
        .from("units")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", auth.organizationId!);

      if (archiveErr) {
        console.error("[Unit Delete Error]", archiveErr);
        return NextResponse.json({ error: "Failed to delete unit" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: `Unit ${unit.unit_number} deleted successfully` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
