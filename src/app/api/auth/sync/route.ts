import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { isAllowedOwnerEmail } from "@/lib/auth/admin-allowlist";
import { safeError } from "@/lib/security/safe-logger";

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
      const decoded = await verifyFirebaseIdToken(idToken);
      uid = decoded.uid;
      email = (decoded.email || "").toLowerCase();
      name = (decoded.name as string) || null;
      picture = (decoded.picture as string) || null;
    } catch (err: unknown) {
      const errorCode = (err as { code?: string })?.code || "unknown";
      const errorMessage = err instanceof Error ? err.message : String(err);
      safeError(`[auth-sync] Token verification failed [code: ${errorCode}]:`, errorMessage);

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
        const descriptiveMessage =
          errorCode === "auth/id-token-expired"
            ? "Authentication token has expired. Please refresh your session."
            : `Token verification failed [${errorCode}]: ${errorMessage}`;
        return NextResponse.json({ error: descriptiveMessage, code: errorCode }, { status: 401 });
      }
    }

    if (!email) {
      return NextResponse.json({ error: "User token must have an email", code: "auth/missing-email" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Find profile by firebase_uid or fallback to email
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("firebase_uid", uid)
      .maybeSingle();

    if (!profile) {
      const { data: existingByEmail } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (existingByEmail) {
        const { data: updated } = await supabase
          .from("profiles")
          .update({
            firebase_uid: uid,
            full_name: name || existingByEmail.full_name,
            photo_url: picture || existingByEmail.photo_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingByEmail.id)
          .select()
          .single();
        profile = updated;
      } else {
        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            firebase_uid: uid,
            email: email.toLowerCase(),
            full_name: name || email.split("@")[0],
            photo_url: picture,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (profileError || !newProfile) {
          safeError("[auth-sync] Profile insert error:", profileError);
          return NextResponse.json({ error: "Failed to persist profile", code: "db/profile-error" }, { status: 500 });
        }
        profile = newProfile;
      }
    }

    const isOwnerAuthorized = isAllowedOwnerEmail(email);
    const normalizedEmail = email.toLowerCase();

    // 2. Parallelize Owner Organization Check & Tenant Profile Association
    const ownerOrgPromise = (async () => {
      if (!isOwnerAuthorized) return [];

      let { data: shekarOrg } = await supabase
        .from("organizations")
        .select("id, name, owner_profile_id")
        .eq("name", "Shekar Homes")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!shekarOrg) {
        const { data: newOrg } = await supabase
          .from("organizations")
          .insert({
            name: "Shekar Homes",
            owner_profile_id: profile.id,
            billing_day_of_month: 10,
            currency: "INR",
            timezone: "Asia/Kolkata",
          })
          .select("id, name, owner_profile_id")
          .single();
        shekarOrg = newOrg;
      }

      if (shekarOrg) {
        await supabase
          .from("organization_memberships")
          .upsert(
            {
              organization_id: shekarOrg.id,
              profile_id: profile.id,
              role: "OWNER",
              status: "ACTIVE",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,profile_id" }
          );
      }

      const { data: ownerMemberships } = await supabase
        .from("organization_memberships")
        .select("*, organization:organizations(*)")
        .eq("profile_id", profile.id)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });

      return ownerMemberships || [];
    })();

    const pendingInvPromise = supabase
      .from("tenant_invitations")
      .select("id, organization_id, unit_id")
      .ilike("invited_email", normalizedEmail)
      .eq("status", "PENDING");

    const linkTenantsPromise = supabase
      .from("tenants")
      .update({
        profile_id: profile.id,
        updated_at: new Date().toISOString(),
      })
      .ilike("email", normalizedEmail);

    const tenantRecordsPromise = supabase
      .from("tenants")
      .select("id")
      .or(`profile_id.eq.${profile.id},email.ilike.${normalizedEmail}`);

    const acceptedInvPromise = supabase
      .from("tenant_invitations")
      .select("id")
      .ilike("invited_email", normalizedEmail)
      .eq("status", "ACCEPTED")
      .limit(1);

    // Execute independent queries in parallel
    const [
      memberships,
      { data: pendingInvitations },
      ,
      { data: tenantRecords },
      { data: acceptedInvitations },
    ] = await Promise.all([
      ownerOrgPromise,
      pendingInvPromise,
      linkTenantsPromise,
      tenantRecordsPromise,
      acceptedInvPromise,
    ]);

    // Handle any pending invitations claim in background
    if (pendingInvitations && pendingInvitations.length > 0) {
      await supabase
        .from("tenant_invitations")
        .update({
          status: "ACCEPTED",
          updated_at: new Date().toISOString(),
        })
        .in("id", pendingInvitations.map((p) => p.id));
    }

    const tenantIds = (tenantRecords || []).map((t) => t.id);
    let hasActiveTenancy = false;
    if (tenantIds.length > 0) {
      const { data: activeTenancies } = await supabase
        .from("tenancies")
        .select("id")
        .in("tenant_id", tenantIds)
        .in("status", ["ACTIVE", "UPCOMING"])
        .limit(1);

      hasActiveTenancy = Boolean(activeTenancies && activeTenancies.length > 0);
    }

    const hasAcceptedInvitation = Boolean(acceptedInvitations && acceptedInvitations.length > 0);
    const isTenant = hasActiveTenancy || hasAcceptedInvitation || (tenantRecords && tenantRecords.length > 0);
    const isOwner = Boolean(isOwnerAuthorized && memberships.length > 0);

    return NextResponse.json({
      profile,
      memberships,
      isOwner,
      isOwnerAuthorized,
      isTenant,
      hasActiveTenancy,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    safeError("[auth-sync] Unexpected error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleAuthSync(req);
}

export async function POST(req: NextRequest) {
  return handleAuthSync(req);
}
