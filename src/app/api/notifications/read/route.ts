import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { notificationId, all } = body as { notificationId?: string; all?: boolean };

    const supabase = createAdminSupabaseClient();
    const nowIso = new Date().toISOString();

    if (all) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: nowIso })
        .eq("recipient_profile_id", auth.profileId)
        .eq("is_read", false);

      if (error) {
        console.error("[Notifications Read All Error]", error);
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    } else if (notificationId) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: nowIso })
        .eq("id", notificationId)
        .eq("recipient_profile_id", auth.profileId);

      if (error) {
        console.error("[Notification Read Single Error]", error);
        return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Notification marked as read" });
    } else {
      return NextResponse.json({ error: "Specify either notificationId or all: true" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
