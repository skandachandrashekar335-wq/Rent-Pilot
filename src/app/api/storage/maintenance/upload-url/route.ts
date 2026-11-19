import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { MaintenanceUploadUrlSchema } from "@/lib/validation/maintenance";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = MaintenanceUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid upload parameters" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const cleanFilename = parsed.data.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const orgFolder = auth.organizationId || "user_personal";
    const storagePath = `${orgFolder}/${auth.profileId}/${Date.now()}_${cleanFilename}`;

    const { data, error } = await supabase.storage
      .from("maintenance-photos")
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || "Failed to generate upload URL" }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
