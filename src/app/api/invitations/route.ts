import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateTenantInvitationSchema } from "@/lib/validation/auth";

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
    const parsed = CreateTenantInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Verify caller is an active OWNER of an organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("firebase_uid", uid)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("profile_id", profile.id)
      .eq("role", "OWNER")
      .eq("status", "ACTIVE")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Only active organization owners can issue invitations" }, { status: 403 });
    }

    // Generate secure random token and SHA-256 hash
    const rawToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parsed.data.expiresInDays || 7));

    const { data: invitation, error: invError } = await supabase
      .from("tenant_invitations")
      .insert({
        organization_id: membership.organization_id,
        unit_id: parsed.data.unitId || null,
        invited_email: parsed.data.invitedEmail,
        token_hash: tokenHash,
        status: "PENDING",
        expires_at: expiresAt.toISOString(),
        created_by: profile.id,
      })
      .select()
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${rawToken}`;

    return NextResponse.json({
      invitation,
      rawToken,
      inviteUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
