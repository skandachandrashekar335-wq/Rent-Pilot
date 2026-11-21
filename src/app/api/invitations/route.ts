import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateTenantInvitationSchema } from "@/lib/validation/auth";
import { sendTenantInvitationEmail, getAppBaseUrl } from "@/lib/notifications/brevo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    if (!auth.isOwnerOrManager || !auth.organizationId) {
      return NextResponse.json({ error: "Only active organization owners or managers can issue invitations" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateTenantInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Verify unit belongs to the caller's organization if specified
    if (parsed.data.unitId) {
      const { data: unit } = await supabase
        .from("units")
        .select("id")
        .eq("id", parsed.data.unitId)
        .eq("organization_id", auth.organizationId)
        .single();

      if (!unit) {
        return NextResponse.json({ error: "Specified unit not found in your organization" }, { status: 404 });
      }
    }

    // Generate secure random token and SHA-256 hash
    const rawToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parsed.data.expiresInDays || 7));

    const { data: invitation, error: invError } = await supabase
      .from("tenant_invitations")
      .insert({
        organization_id: auth.organizationId,
        unit_id: parsed.data.unitId || null,
        invited_email: parsed.data.invitedEmail,
        token_hash: tokenHash,
        status: "PENDING",
        expires_at: expiresAt.toISOString(),
        created_by: auth.profileId,
      })
      .select()
      .single();

    if (invError) {
      console.error("[Invitations API Error]", invError);
      return NextResponse.json({ error: "Failed to generate invitation" }, { status: 500 });
    }

    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", auth.organizationId)
      .maybeSingle();

    let unitNumber: string | undefined;
    let propertyName: string | undefined;

    if (parsed.data.unitId) {
      const { data: uData } = await supabase
        .from("units")
        .select("unit_number, property:properties(name)")
        .eq("id", parsed.data.unitId)
        .maybeSingle();
      unitNumber = uData?.unit_number;
      propertyName = (uData?.property as unknown as { name?: string })?.name;
    }

    const emailResult = await sendTenantInvitationEmail({
      tenantEmail: parsed.data.invitedEmail,
      tenantName: parsed.data.fullName || parsed.data.invitedEmail.split("@")[0],
      organizationName: orgData?.name || "Shekar Homes",
      propertyName,
      unitCode: unitNumber,
      rawToken,
      expiresInDays: parsed.data.expiresInDays || 7,
      organizationId: auth.organizationId,
    });

    const inviteUrl = emailResult.inviteUrl || `${getAppBaseUrl()}/invite/${rawToken}`;

    return NextResponse.json({
      invitation,
      rawToken,
      inviteUrl,
      emailSent: emailResult.sent,
      emailError: emailResult.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
