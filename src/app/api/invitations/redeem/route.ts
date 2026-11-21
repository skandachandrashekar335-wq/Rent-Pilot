import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawInput = body.token || body.inviteCode || body.code || "";
    const cleanToken = String(rawInput)
      .trim()
      .replace(/^.*\/invite\//i, "")
      .split(/[?#]/)[0]
      .trim();

    if (!cleanToken) {
      return NextResponse.json(
        { error: "Please enter a valid invitation code or link" },
        { status: 400 }
      );
    }

    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json(
        { error: errorResponse?.message || "Must be signed in to redeem an invitation" },
        { status: errorResponse?.status || 401 }
      );
    }

    const userEmail = auth.email.toLowerCase();
    const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");
    const supabase = createAdminSupabaseClient();

    const { data: invitation, error } = await supabase
      .from("tenant_invitations")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !invitation) {
      return NextResponse.json(
        { error: "Invitation code not found or invalid" },
        { status: 404 }
      );
    }

    // Email match check
    if (invitation.invited_email.toLowerCase() !== userEmail) {
      return NextResponse.json(
        {
          error: `This invitation was issued to ${invitation.invited_email}. You are currently signed in as ${userEmail}. Please sign in with the invited email address.`,
        },
        { status: 403 }
      );
    }

    if (invitation.status === "ACCEPTED") {
      // Ensure tenant profile is linked
      await supabase
        .from("tenants")
        .update({
          profile_id: auth.profileId,
          updated_at: new Date().toISOString(),
        })
        .ilike("email", invitation.invited_email);

      return NextResponse.json({
        success: true,
        message: "Invitation is already active. Welcome to your portal!",
        redirectTo: "/portal",
        organizationId: invitation.organization_id,
        unitId: invitation.unit_id,
      });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `This invitation is ${invitation.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase.from("tenant_invitations").update({ status: "EXPIRED" }).eq("id", invitation.id);
      return NextResponse.json({ error: "This invitation code has expired" }, { status: 400 });
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

    // Link tenant profile_id upon redemption
    await supabase
      .from("tenants")
      .update({
        profile_id: auth.profileId,
        updated_at: new Date().toISOString(),
      })
      .ilike("email", invitation.invited_email);

    return NextResponse.json({
      success: true,
      message: "Invitation successfully redeemed! Welcome to your Tenant Portal.",
      redirectTo: "/portal",
      organizationId: invitation.organization_id,
      unitId: invitation.unit_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
