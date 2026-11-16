import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateOrganizationSchema } from "@/lib/validation/auth";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let uid: string;

    try {
      const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      if (process.env.NODE_ENV === "development") {
        uid = "dev-firebase-uid";
      } else {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    const body = await req.json();
    const parsed = CreateOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Get Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("firebase_uid", uid)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found. Please sync auth first." }, { status: 404 });
    }

    // Insert Organization
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: parsed.data.name,
        owner_profile_id: profile.id,
        billing_day_of_month: parsed.data.billingDayOfMonth,
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
      })
      .select()
      .single();

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    // Insert Owner Membership
    const { data: membership, error: memError } = await supabase
      .from("organization_memberships")
      .insert({
        organization_id: organization.id,
        profile_id: profile.id,
        role: "OWNER",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (memError) {
      return NextResponse.json({ error: memError.message }, { status: 500 });
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
