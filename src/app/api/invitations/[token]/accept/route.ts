import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Must be signed in to accept an invitation" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let userEmail: string;

    try {
      const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
      userEmail = (decoded.email || "").toLowerCase();
    } catch {
      if (process.env.NODE_ENV === "development") {
        userEmail = "dev@rentpilot.app";
      } else {
        return NextResponse.json({ error: "Invalid authentication token" }, { status: 401 });
      }
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const supabase = createAdminSupabaseClient();

    const { data: invitation, error } = await supabase
      .from("tenant_invitations")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: `Invitation is already ${invitation.status.toLowerCase()}` }, { status: 400 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase.from("tenant_invitations").update({ status: "EXPIRED" }).eq("id", invitation.id);
      return NextResponse.json({ error: "This invitation has expired" }, { status: 400 });
    }

    // MANDATORY SECURITY CHECK: User email must match invited email
    if (invitation.invited_email.toLowerCase() !== userEmail) {
      return NextResponse.json(
        {
          error: `This invitation was issued to ${invitation.invited_email}. You are currently signed in as ${userEmail}. Please sign in with the invited email address.`,
        },
        { status: 403 }
      );
    }

    // Mark invitation ACCEPTED
    const { error: updateError } = await supabase
      .from("tenant_invitations")
      .update({
        status: "ACCEPTED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Link tenant profile_id upon invitation acceptance
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();

    if (userProfile) {
      await supabase
        .from("tenants")
        .update({
          profile_id: userProfile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", invitation.organization_id)
        .eq("email", invitation.invited_email);
    }

    return NextResponse.json({
      success: true,
      message: "Invitation accepted. Welcome to your rental portal!",
      organizationId: invitation.organization_id,
      unitId: invitation.unit_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
