import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateOrganizationSchema } from "@/lib/validation/auth";

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

    // Insert Organization
    const { data: organization, error: orgError } = await supabase
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
      console.error("[Organizations API Error]", orgError);
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    // Insert Owner Membership
    const { data: membership, error: memError } = await supabase
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

    return NextResponse.json({
      organization,
      membership,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
