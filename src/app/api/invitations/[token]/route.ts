import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const supabase = createAdminSupabaseClient();

    const { data: invitation, error } = await supabase
      .from("tenant_invitations")
      .select("*, organization:organizations(name, currency)")
      .eq("token_hash", tokenHash)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: "Invitation not found or invalid" }, { status: 404 });
    }

    const isExpired = new Date(invitation.expires_at) < new Date();
    if (isExpired && invitation.status === "PENDING") {
      await supabase
        .from("tenant_invitations")
        .update({ status: "EXPIRED" })
        .eq("id", invitation.id);
      invitation.status = "EXPIRED";
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        organizationName: invitation.organization?.name || "Rental Organization",
        invitedEmail: invitation.invitedEmail || invitation.invited_email,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        isExpired,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
