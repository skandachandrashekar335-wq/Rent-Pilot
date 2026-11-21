import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateTenancySchema } from "@/lib/validation/rental";
import { rupeesToPaise } from "@/lib/domain/rent-increments";
import { sendTenantInvitationEmail, getAppBaseUrl } from "@/lib/notifications/brevo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const orgId = auth.organizationId;
    if (!orgId) {
      return NextResponse.json({ tenancies: [] });
    }

    const supabase = createAdminSupabaseClient();
    const { data: tenancies, error } = await supabase
      .from("tenancies")
      .select(`
        *,
        tenant:tenants(*),
        unit:units(
          *,
          property:properties(id, name, address_line, city)
        ),
        rent_increment_schedules:rent_increment_schedules(*)
      `)
      .eq("organization_id", orgId)
      .order("start_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: invitations } = await supabase
      .from("tenant_invitations")
      .select("id, unit_id, invited_email, status, expires_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    const invitationsByUnit = new Map();
    (invitations || []).forEach((inv) => {
      if (inv.unit_id && !invitationsByUnit.has(inv.unit_id)) {
        invitationsByUnit.set(inv.unit_id, inv);
      }
    });

    const enrichedTenancies = (tenancies || []).map((t) => ({
      ...t,
      latestInvitation: invitationsByUnit.get(t.unit_id) || null,
    }));

    return NextResponse.json({ tenancies: enrichedTenancies });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const parsed = CreateTenancySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const orgId = auth.organizationId;
    const supabase = createAdminSupabaseClient();

    // Verify unit belongs to this organization
    const { data: unit } = await supabase
      .from("units")
      .select("id")
      .eq("id", parsed.data.unitId)
      .eq("organization_id", orgId)
      .single();

    if (!unit) {
      return NextResponse.json({ error: "Unit not found in your organization" }, { status: 404 });
    }

    // 1. Resolve or Create Tenant Record
    let tenantId = parsed.data.tenantId;
    if (!tenantId) {
      // Check if tenant with this email exists in org
      const { data: existingTenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("organization_id", orgId)
        .eq("email", parsed.data.tenantEmail)
        .maybeSingle();

      if (existingTenant) {
        tenantId = existingTenant.id;
      } else {
        // Check if there is an existing registered profile with this email to link immediately
        const { data: matchingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", parsed.data.tenantEmail)
          .maybeSingle();

        const { data: newTenant, error: tenantErr } = await supabase
          .from("tenants")
          .insert({
            organization_id: orgId,
            profile_id: matchingProfile?.id || null,
            full_name: parsed.data.tenantFullName,
            email: parsed.data.tenantEmail,
            phone: parsed.data.tenantPhone || null,
          })
          .select("id")
          .single();

        if (tenantErr || !newTenant) {
          return NextResponse.json({ error: tenantErr?.message || "Failed to create tenant record" }, { status: 500 });
        }
        tenantId = newTenant.id;
      }
    }

    const monthlyRentPaise = rupeesToPaise(parsed.data.monthlyRentRupees);
    const securityDepositPaise = rupeesToPaise(parsed.data.securityDepositRupees);

    // 2. Insert Tenancy (Protected by PostgreSQL GiST exclusion constraint)
    const { data: tenancy, error: tenancyErr } = await supabase
      .from("tenancies")
      .insert({
        organization_id: orgId,
        unit_id: parsed.data.unitId,
        tenant_id: tenantId,
        start_date: parsed.data.startDate,
        end_date: parsed.data.endDate || null,
        monthly_rent_paise: Number(monthlyRentPaise),
        security_deposit_paise: Number(securityDepositPaise),
        status: parsed.data.status,
      })
      .select(`
        *,
        tenant:tenants(*),
        unit:units(*, property:properties(*))
      `)
      .single();

    if (tenancyErr) {
      // PostgreSQL 23P01 = exclusion_violation
      if (tenancyErr.code === "23P01" || tenancyErr.message.includes("no_overlapping_tenancies_per_unit")) {
        return NextResponse.json(
          {
            error: "This unit already has an active or upcoming lease covering these dates. Tenancy dates cannot overlap.",
            code: "TENANCY_OVERLAP_CONFLICT",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: tenancyErr.message }, { status: 500 });
    }

    // 3. Update Unit Occupancy Status to OCCUPIED
    await supabase
      .from("units")
      .update({ occupancy_status: "OCCUPIED", updated_at: new Date().toISOString() })
      .eq("id", parsed.data.unitId);

    // 4. Optionally Insert Rent Increment Schedule
    let createdSchedule = null;
    if (parsed.data.incrementSchedule) {
      const { data: schedule, error: schedErr } = await supabase
        .from("rent_increment_schedules")
        .insert({
          organization_id: orgId,
          tenancy_id: tenancy.id,
          increment_type: parsed.data.incrementSchedule.incrementType,
          increment_value: parsed.data.incrementSchedule.incrementValue,
          interval_months: parsed.data.incrementSchedule.intervalMonths,
          next_increment_date: parsed.data.incrementSchedule.nextIncrementDate,
          auto_apply: parsed.data.incrementSchedule.autoApply,
          status: "ACTIVE",
        })
        .select()
        .single();

      if (!schedErr) {
        createdSchedule = schedule;
      }
    }

    // 5. Automatically Generate an Onboarding Invitation for the Tenant
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase.from("tenant_invitations").insert({
      organization_id: orgId,
      unit_id: parsed.data.unitId,
      invited_email: parsed.data.tenantEmail,
      token_hash: tokenHash,
      status: "PENDING",
      expires_at: expiresAt.toISOString(),
      created_by: auth.profileId,
    });

    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    const orgName = orgData?.name || "Shekar Homes";

    const { data: unitData } = await supabase
      .from("units")
      .select("unit_number, property:properties(name)")
      .eq("id", parsed.data.unitId)
      .maybeSingle();

    const emailResult = await sendTenantInvitationEmail({
      tenantEmail: parsed.data.tenantEmail,
      tenantName: parsed.data.tenantFullName,
      organizationName: orgName,
      propertyName: (unitData?.property as unknown as { name?: string })?.name,
      unitCode: unitData?.unit_number,
      rawToken,
      expiresInDays: 7,
      organizationId: orgId,
    });

    const inviteUrl = emailResult.inviteUrl || `${getAppBaseUrl()}/invite/${rawToken}`;

    return NextResponse.json(
      {
        tenancy,
        incrementSchedule: createdSchedule,
        inviteUrl,
        rawToken,
        emailSent: emailResult.sent,
        emailError: emailResult.error,
        message: "Tenancy successfully created.",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
