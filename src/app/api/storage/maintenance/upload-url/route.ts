import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { MaintenanceUploadUrlSchema } from "@/lib/validation/maintenance";
import { safeError } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = MaintenanceUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid upload parameters" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const safeExt = MIME_TO_EXT[parsed.data.mimeType] || "jpg";
    const uniqueId = crypto.randomUUID();
    const orgFolder = auth.organizationId || "user_personal";
    const storagePath = `${orgFolder}/${auth.profileId}/${uniqueId}.${safeExt}`;

    const { data, error } = await supabase.storage
      .from("maintenance-photos")
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl) {
      safeError("[Storage Error - maintenance-photos]", error?.message);
      return NextResponse.json({ error: error?.message || "Failed to generate upload URL" }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    safeError("[Storage Route Error - maintenance-photos]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
