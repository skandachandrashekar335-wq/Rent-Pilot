import { createAdminSupabaseClient } from "@/lib/supabase/server";

export interface CreateInAppNotificationParams {
  organizationId: string;
  recipientProfileId: string;
  type: string;
  title: string;
  body: string;
  linkHref?: string | null;
}

export async function createInAppNotification(params: CreateInAppNotificationParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        organization_id: params.organizationId,
        recipient_profile_id: params.recipientProfileId,
        type: params.type,
        title: params.title,
        body: params.body,
        link_href: params.linkHref || null,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[In-App Notification Error]", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.warn("[In-App Notification Exception]", msg);
    return { success: false, error: msg };
  }
}
