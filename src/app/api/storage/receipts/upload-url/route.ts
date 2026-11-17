import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const { filename, contentType, fileSize } = body;

    if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, WEBP, and PDF receipts are accepted." },
        { status: 400 }
      );
    }

    if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 5 MB limit. Please compress or crop the screenshot." },
        { status: 400 }
      );
    }

    const ext = filename ? filename.split(".").pop() : "png";
    const uniqueId = crypto.randomUUID();
    const storagePath = `org_${auth.organizationId || "general"}/${uniqueId}.${ext}`;

    const supabase = createAdminSupabaseClient();
    const { data: signedUpload, error: storageErr } = await supabase.storage
      .from("receipts")
      .createSignedUploadUrl(storagePath);

    if (storageErr) {
      // In local dev/mock without active Supabase project:
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
