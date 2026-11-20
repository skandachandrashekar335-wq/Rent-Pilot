import { NextRequest } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { isAllowedOwnerEmail } from "./admin-allowlist";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  profileId: string;
  organizationId?: string;
  isOwnerOrManager: boolean;
  isOwnerAuthorized: boolean;
}

const isDevAuthBypassAllowed =
  (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_AUTH_BYPASS === "true") &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV &&
  process.env.ALLOW_DEV_AUTH_BYPASS === "true";

export async function verifyServerAuth(
  req: NextRequest,
  requiredOrgId?: string
): Promise<{ auth: AuthenticatedUser | null; errorResponse?: { message: string; code?: string; status: number } }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      auth: null,
      errorResponse: { message: "Authentication required", code: "auth/missing-header", status: 401 },
    };
  }

  const idToken = authHeader.split("Bearer ")[1];
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
    console.error(`[server-auth] Token verification failed [code: ${errorCode}]:`, errorMessage);

    if (isDevAuthBypassAllowed && idToken === "dev-test-token") {
      uid = "dev-firebase-uid";
      email = "dev@rentpilot.app";
    } else {
      const descriptiveMessage =
        errorCode === "auth/id-token-expired"
          ? "Authentication token has expired. Please refresh your session."
          : `Token verification failed [${errorCode}]: ${errorMessage}`;

      return {
        auth: null,
        errorResponse: { message: descriptiveMessage, code: errorCode, status: 401 },
      };
    }
  }

  const supabase = createAdminSupabaseClient();

  // Retrieve user profile (check firebase_uid, then fallback to email)
  let { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, firebase_uid")
    .eq("firebase_uid", uid)
    .maybeSingle();

  if (!profile) {
    const { data: existingByEmail } = await supabase
      .from("profiles")
      .select("id, email, full_name, firebase_uid")
      .eq("email", email)
      .maybeSingle();

    if (existingByEmail) {
      await supabase
        .from("profiles")
        .update({
          firebase_uid: uid,
          photo_url: picture,
          full_name: name || existingByEmail.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingByEmail.id);
      profile = { ...existingByEmail, firebase_uid: uid };
    }
  }

  // Auto-provision profile on first real Google login if not found
  if (!profile) {
    const fallbackName = name || email.split("@")[0] || "User";
    const { data: newProfile, error: createProfileErr } = await supabase
      .from("profiles")
      .insert({
        firebase_uid: uid,
        email: email,
        full_name: fallbackName,
        photo_url: picture,
      })
      .select("id, email, full_name, firebase_uid")
      .single();

    if (createProfileErr) {
      console.error("[server-auth] Failed to auto-provision profile:", createProfileErr);
      return {
        auth: null,
        errorResponse: { message: "Failed to initialize user profile", code: "db/profile-error", status: 500 },
      };
    }
    profile = newProfile;
  }

  const isOwnerAuthorized = isAllowedOwnerEmail(email);
  let isOwnerOrManager = false;
  let activeOrgId = requiredOrgId;

  if (isOwnerAuthorized) {
    // 1. Both allowlisted emails share the exact same primary Organization "Shekar Homes"
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

      activeOrgId = requiredOrgId || shekarOrg.id;
      isOwnerOrManager = true;
    }
  } else {
    // Non-allowlisted user: NEVER auto-provision an OWNER organization or membership!
    if (requiredOrgId) {
      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("role, status")
        .eq("organization_id", requiredOrgId)
        .eq("profile_id", profile.id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (membership && (membership.role === "OWNER" || membership.role === "MANAGER")) {
        isOwnerOrManager = true;
      }
    } else {
      const { data: memberships } = await supabase
        .from("organization_memberships")
        .select("organization_id, role")
        .eq("profile_id", profile.id)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });

      if (memberships && memberships.length > 0) {
        activeOrgId = memberships[0].organization_id;
        isOwnerOrManager = memberships.some((m) => m.role === "OWNER" || m.role === "MANAGER");
      }
    }
  }

  return {
    auth: {
      uid,
      email: profile.email,
      profileId: profile.id,
      organizationId: activeOrgId,
      isOwnerOrManager,
      isOwnerAuthorized,
    },
  };
}

export async function requireOwnerAuth(
  req: NextRequest,
  requiredOrgId?: string
): Promise<{ auth: AuthenticatedUser | null; errorResponse?: { message: string; code?: string; status: number } }> {
  const { auth, errorResponse } = await verifyServerAuth(req, requiredOrgId);
  if (errorResponse || !auth) {
    return { auth: null, errorResponse };
  }

  if (!auth.isOwnerAuthorized) {
    return {
      auth: null,
      errorResponse: {
        message: "Access denied. Only authorized administrator accounts can access the Owner Portal.",
        code: "auth/forbidden",
        status: 403,
      },
    };
  }

  return { auth };
}
