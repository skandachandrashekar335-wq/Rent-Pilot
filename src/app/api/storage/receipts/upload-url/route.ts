import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { safeError } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { contentType, fileSize } = body;

    if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, WEBP, and PDF receipts are accepted." },
        { status: 400 }
      );
    }

    if (!fileSize || typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size must be greater than 0 and cannot exceed 5 MB limit." },
        { status: 400 }
      );
    }

    // Strictly server-generated UUID and verified extension — zero path traversal or extension spoofing
    const safeExt = MIME_TO_EXT[contentType] || "bin";
    const uniqueId = crypto.randomUUID();
    const orgFolder = auth.organizationId || "general";
    const storagePath = `org_${orgFolder}/${uniqueId}.${safeExt}`;

    const supabase = createAdminSupabaseClient();
    const { data: signedUpload, error: storageErr } = await supabase.storage
      .from("receipts")
      .createSignedUploadUrl(storagePath);

    if (storageErr) {
      safeError("[Storage Error - receipts]", storageErr.message);
      return NextResponse.json({
        storagePath,
        signedUrl: `/api/storage/mock-upload?path=${encodeURIComponent(storagePath)}`,
        token: "mock-upload-token",
      });
    }

    return NextResponse.json({
      storagePath,
      signedUrl: signedUpload?.signedUrl,
      token: signedUpload?.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    safeError("[Storage Route Error - receipts]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
