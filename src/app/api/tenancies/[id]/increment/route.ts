import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ApplyRentIncrementSchema } from "@/lib/validation/rental";
import { rupeesToPaise, computeNextIncrementDate } from "@/lib/domain/rent-increments";

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

    const body = await req.json();
    const parsed = ApplyRentIncrementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Fetch current tenancy
    const { data: tenancy, error: getErr } = await supabase
      .from("tenancies")
      .select("*, rent_increment_schedules(*)")
      .eq("id", tenancyId)
      .eq("organization_id", auth.organizationId!)
      .single();

    if (getErr || !tenancy) {
      return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
    }

    const previousRentPaise = BigInt(tenancy.monthly_rent_paise);
    const newRentPaise = rupeesToPaise(parsed.data.newRentRupees);

    // 2. Insert into rent_increment_history (Strict historical preservation)
    const activeSchedule = tenancy.rent_increment_schedules?.[0] || null;

    const { error: histErr } = await supabase.from("rent_increment_history").insert({
      organization_id: tenancy.organization_id,
      tenancy_id: tenancy.id,
      schedule_id: activeSchedule?.id || null,
      previous_rent_paise: Number(previousRentPaise),
      new_rent_paise: Number(newRentPaise),
      effective_date: parsed.data.effectiveDate,
      applied_by_profile_id: auth.profileId,
      notes: parsed.data.notes || null,
    });

    if (histErr) {
      return NextResponse.json({ error: histErr.message }, { status: 500 });
    }

    // 3. Update tenancy current monthly_rent_paise
    const { data: updatedTenancy, error: updErr } = await supabase
      .from("tenancies")
      .update({
        monthly_rent_paise: Number(newRentPaise),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenancy.id)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // 4. If an active schedule exists, compute next increment date and advance schedule
    if (activeSchedule) {
      const nextDate = computeNextIncrementDate(parsed.data.effectiveDate, activeSchedule.interval_months);
      await supabase
        .from("rent_increment_schedules")
        .update({
          next_increment_date: nextDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeSchedule.id);
    }

    return NextResponse.json({
      success: true,
      tenancy: updatedTenancy,
      message: `Rent increment successfully applied. New rent: ₹${parsed.data.newRentRupees.toLocaleString("en-IN")}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
