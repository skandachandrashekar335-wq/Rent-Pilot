import { NextRequest } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  profileId: string;
  organizationId?: string;
  isOwnerOrManager: boolean;
}

const isDevAuthBypassAllowed =
  (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_AUTH_BYPASS === "true") &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV &&
  process.env.ALLOW_DEV_AUTH_BYPASS === "true";

export async function verifyServerAuth(
  req: NextRequest,
  requiredOrgId?: string
): Promise<{ auth: AuthenticatedUser | null; errorResponse?: { message: string; status: number } }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      auth: null,
      errorResponse: { message: "Authentication required", status: 401 },
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
          : errorCode !== "unknown"
          ? `Token verification failed [${errorCode}]: ${errorMessage}`
          : "Invalid or expired authentication token";

      return {
        auth: null,
        errorResponse: { message: descriptiveMessage, status: 401 },
      };
    }
  }

  const supabase = createAdminSupabaseClient();

  // Retrieve user profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("firebase_uid", uid)
    .maybeSingle();

  // Auto-provision profile on first real Google login if not found
  if (!profile) {
    const fallbackName = name || email.split("@")[0] || "Property Owner";
    const { data: newProfile, error: createProfileErr } = await supabase
      .from("profiles")
      .insert({
        firebase_uid: uid,
        email: email,
        full_name: fallbackName,
        photo_url: picture,
      })
      .select("id, email, full_name")
      .single();

    if (createProfileErr) {
      console.error("[server-auth] Failed to auto-provision profile:", createProfileErr);
      return {
        auth: null,
        errorResponse: { message: "Failed to initialize user profile", status: 500 },
      };
    }
    profile = newProfile;
  }

  // Check organization membership
  let isOwnerOrManager = false;
  let activeOrgId = requiredOrgId;

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
    // Look up primary active organization membership
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("profile_id", profile.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (memberships && memberships.length > 0) {
      activeOrgId = memberships[0].organization_id;
      isOwnerOrManager = memberships.some((m) => m.role === "OWNER" || m.role === "MANAGER");
    } else {
      // Auto-provision default organization for new landlords on first login
      const defaultOrgName = profile.full_name
        ? `${profile.full_name}'s Properties`
        : "My Properties";

      let { data: defaultOrg } = await supabase
        .from("organizations")
        .select("id")
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
          .select("id")
          .single();

        if (orgError) {
          console.error("[server-auth] Failed to auto-create default organization:", orgError);
        } else {
          defaultOrg = newOrg;
        }
      }

      if (defaultOrg) {
        await supabase
          .from("organization_memberships")
          .upsert(
            {
              organization_id: defaultOrg.id,
              profile_id: profile.id,
              role: "OWNER",
              status: "ACTIVE",
            },
            { onConflict: "organization_id,profile_id" }
          );
        activeOrgId = defaultOrg.id;
        isOwnerOrManager = true;
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
    },
  };
}
