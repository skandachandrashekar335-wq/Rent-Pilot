import { NextRequest } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  profileId: string;
  organizationId?: string;
  isOwnerOrManager: boolean;
}

const isDevAuthBypassAllowed =
  process.env.NODE_ENV === "development" &&
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

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = (decoded.email || "").toLowerCase();
  } catch {
    if (isDevAuthBypassAllowed) {
      uid = "dev-firebase-uid";
      email = "dev@rentpilot.app";
    } else {
      return {
        auth: null,
        errorResponse: { message: "Invalid or expired authentication token", status: 401 },
      };
    }
  }

  const supabase = createAdminSupabaseClient();

  // Retrieve user profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("firebase_uid", uid)
    .single();

  // If in dev and no profile exists yet, auto-create mock profile
  if (!profile && isDevAuthBypassAllowed) {
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        firebase_uid: uid,
        email: email,
        full_name: "RentPilot Developer",
      })
      .select("id, email")
      .single();
    profile = newProfile;
  }

  if (!profile) {
    return {
      auth: null,
      errorResponse: { message: "User profile not found. Please sync authentication first.", status: 404 },
    };
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
      .single();

    if (membership && (membership.role === "OWNER" || membership.role === "MANAGER")) {
      isOwnerOrManager = true;
    }
  } else {
    // Look up primary active organization membership
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("profile_id", profile.id)
      .eq("status", "ACTIVE");

    if (memberships && memberships.length > 0) {
      activeOrgId = memberships[0].organization_id;
      isOwnerOrManager = memberships.some((m) => m.role === "OWNER" || m.role === "MANAGER");
    } else if (isDevAuthBypassAllowed) {
      // Auto-provision dev organization if none exists
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
            name: "Sri Lakshmi Estates",
            owner_profile_id: profile.id,
            billing_day_of_month: 10,
            currency: "INR",
            timezone: "Asia/Kolkata",
          })
          .select("id")
          .single();
        if (orgError) {
          console.error("Failed to auto-create dev organization:", orgError);
        }
        defaultOrg = newOrg;
      }

      if (defaultOrg) {
        await supabase
          .from("organization_memberships")
          .upsert({
            organization_id: defaultOrg.id,
            profile_id: profile.id,
            role: "OWNER",
            status: "ACTIVE",
          }, { onConflict: "organization_id,profile_id" });
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
