import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return NextResponse.json({ error: "Bearer token required" }, { status: 401 });
    }

    let uid: string;
    let email: string;
    let name: string | null = null;
    let picture: string | null = null;

    try {
      const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email || "";
      name = decoded.name || null;
      picture = decoded.picture || null;
    } catch {
      // Strictly disabled in production, on Vercel, or without explicit flag
      const isDevAuthAllowed =
        process.env.NODE_ENV === "development" &&
        !process.env.VERCEL &&
        !process.env.VERCEL_ENV &&
        process.env.ALLOW_DEV_AUTH_BYPASS === "true";

      const body = await req.json().catch(() => ({}));
      if (isDevAuthAllowed && body.devUser) {
        uid = body.devUser.uid || "dev-firebase-uid";
        email = body.devUser.email || "dev@rentpilot.app";
        name = body.devUser.name || "Development User";
      } else {
        return NextResponse.json({ error: "Invalid Firebase ID token" }, { status: 401 });
      }
    }

    if (!email) {
      return NextResponse.json({ error: "User token must have an email" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Upsert Profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          firebase_uid: uid,
          email: email.toLowerCase(),
          full_name: name,
          photo_url: picture,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "firebase_uid" }
      )
      .select()
      .single();

    if (profileError) {
      // If mock client without real database connection, return simulated profile
      return NextResponse.json({
        profile: {
          id: "simulated-profile-id",
          firebase_uid: uid,
          email: email.toLowerCase(),
          full_name: name,
          preferred_locale: "en",
        },
        memberships: [],
        isOwner: false,
        isTenant: false,
      });
    }

    // 2. Fetch Organization Memberships
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("*, organization:organizations(*)")
      .eq("profile_id", profile.id)
      .eq("status", "ACTIVE");

    const isOwner = memberships ? memberships.some((m: { role: string }) => m.role === "OWNER") : false;

    // 3. Check for Active Tenancy or Invitations
    const { data: invitations } = await supabase
      .from("tenant_invitations")
      .select("*, organization:organizations(name)")
      .eq("invited_email", email.toLowerCase())
      .eq("status", "ACCEPTED");

    const isTenant = invitations && invitations.length > 0;

    return NextResponse.json({
      profile,
      memberships: memberships || [],
      isOwner,
      isTenant,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
