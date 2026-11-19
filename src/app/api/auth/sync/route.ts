import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function handleAuthSync(req: NextRequest) {
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
      const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
      uid = decoded.uid;
      email = (decoded.email || "").toLowerCase();
      name = (decoded.name as string) || null;
      picture = (decoded.picture as string) || null;
    } catch (err: unknown) {
      const errorCode = (err as { code?: string })?.code || "unknown";
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[auth-sync] Token verification failed [code: ${errorCode}]:`, errorMessage);

      // Strictly disabled on Vercel or without explicit local flag
      const isDevAuthAllowed =
        (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_AUTH_BYPASS === "true") &&
        !process.env.VERCEL &&
        !process.env.VERCEL_ENV &&
        process.env.ALLOW_DEV_AUTH_BYPASS === "true";

      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      if (isDevAuthAllowed) {
        uid = body.devUser?.uid || "dev-firebase-uid";
        email = body.devUser?.email || "dev@rentpilot.app";
        name = body.devUser?.name || "Development User";
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
          full_name: name || email.split("@")[0],
          photo_url: picture,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "firebase_uid" }
      )
      .select()
      .single();

    if (profileError || !profile) {
      console.error("[auth-sync] Profile upsert error:", profileError);
      return NextResponse.json({ error: "Failed to persist profile" }, { status: 500 });
    }

    // 2. Fetch Organization Memberships
    let { data: memberships } = await supabase
      .from("organization_memberships")
      .select("*, organization:organizations(*)")
      .eq("profile_id", profile.id)
      .eq("status", "ACTIVE");

    // 3. Check for Active Tenancies / Invitations
    const { data: invitations } = await supabase
      .from("tenant_invitations")
      .select("*, organization:organizations(name)")
      .eq("invited_email", email.toLowerCase())
      .eq("status", "ACCEPTED");

    const isTenant = Boolean(invitations && invitations.length > 0);

    // 4. If user has no memberships and is not a tenant, auto-provision default organization as OWNER
    if ((!memberships || memberships.length === 0) && !isTenant) {
      const defaultOrgName = profile.full_name
        ? `${profile.full_name}'s Properties`
        : "My Properties";

      let { data: defaultOrg } = await supabase
        .from("organizations")
        .select("id, name, owner_profile_id, billing_day_of_month, currency, timezone")
        .eq("owner_profile_id", profile.id)
        .limit(1)
        .maybeSingle();

      if (!defaultOrg) {
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: defaultOrgName,
            owner_profile_id: profile.id,
            billing_day_of_month: 1,
            currency: "INR",
            timezone: "Asia/Kolkata",
          })
          .select("id, name, owner_profile_id, billing_day_of_month, currency, timezone")
          .single();

        if (orgError) {
          console.error("[auth-sync] Auto-create organization failed:", orgError);
        } else {
          defaultOrg = newOrg;
        }
      }

      if (defaultOrg) {
        const { data: newMembership } = await supabase
          .from("organization_memberships")
          .upsert(
            {
              organization_id: defaultOrg.id,
              profile_id: profile.id,
              role: "OWNER",
              status: "ACTIVE",
            },
            { onConflict: "organization_id,profile_id" }
          )
          .select("*, organization:organizations(*)")
          .single();

        if (newMembership) {
          memberships = [newMembership];
        }
      }
    }

    const isOwner = memberships ? memberships.some((m: { role: string }) => m.role === "OWNER") : false;

    return NextResponse.json({
      profile,
      memberships: memberships || [],
      isOwner,
      isTenant,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[auth-sync] Unexpected error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleAuthSync(req);
}

export async function POST(req: NextRequest) {
  return handleAuthSync(req);
}
