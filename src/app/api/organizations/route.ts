import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateOrganizationSchema } from "@/lib/validation/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = CreateOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Check if user already has an existing organization as OWNER
    const { data: existingMembership } = await supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("profile_id", auth.profileId)
      .eq("role", "OWNER")
      .maybeSingle();

    let organization;
    let membership;

    if (existingMembership?.organization_id) {
      // Update existing organization name and billing parameters
      const { data: updatedOrg, error: orgUpdateError } = await supabase
        .from("organizations")
        .update({
          name: parsed.data.name,
          billing_day_of_month: parsed.data.billingDayOfMonth,
          currency: parsed.data.currency,
          timezone: parsed.data.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.organization_id)
        .select()
        .single();

      if (orgUpdateError) {
        console.error("[Organizations API Error - Update]", orgUpdateError);
        return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
      }
      organization = updatedOrg;
      membership = existingMembership;
    } else {
      // Insert new organization
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: parsed.data.name,
          owner_profile_id: auth.profileId,
          billing_day_of_month: parsed.data.billingDayOfMonth,
          currency: parsed.data.currency,
          timezone: parsed.data.timezone,
        })
        .select()
        .single();

      if (orgError) {
        console.error("[Organizations API Error - Insert]", orgError);
        return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
      }
      organization = newOrg;

      // Insert Owner Membership
      const { data: newMembership, error: memError } = await supabase
        .from("organization_memberships")
        .insert({
          organization_id: organization.id,
          profile_id: auth.profileId,
          role: "OWNER",
          status: "ACTIVE",
        })
        .select()
        .single();

      if (memError) {
        console.error("[Organization Membership Error]", memError);
        return NextResponse.json({ error: "Failed to create organization membership" }, { status: 500 });
      }
      membership = newMembership;
    }

    return NextResponse.json({
      organization,
      membership,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
