import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { UpdateMaintenanceRequestSchema } from "@/lib/validation/maintenance";
import { rupeesToPaise, paiseToRupees } from "@/lib/domain/billing";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { sendMaintenanceStatusUpdatedToTenantEmail } from "@/lib/notifications/brevo";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Fetch Maintenance Request
    const { data: request, error: reqErr } = await supabase
      .from("maintenance_requests")
      .select(`
        *,
        property:properties(id, name, address_line, city),
        unit:units(id, unit_number, configuration_label, floor_number),
        tenancy:tenancies(
          id,
          monthly_rent_paise,
          tenant:tenants(id, full_name, email, phone)
        ),
        reported_by:profiles(id, full_name, email)
      `)
      .eq("id", id)
      .single();

    if (reqErr || !request) {
      return NextResponse.json({ error: "Maintenance request not found" }, { status: 404 });
    }

    // 2. Authorization check
    if (!auth.isOwnerOrManager) {
      // Check if ticket belongs to tenant
      const { data: tenantRecord } = await supabase
        .from("tenants")
        .select("id")
        .eq("profile_id", auth.profileId)
        .single();

      if (!tenantRecord) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select("id")
        .eq("id", request.tenancy_id)
        .eq("tenant_id", tenantRecord.id)
        .single();

      if (!tenancy) {
        return NextResponse.json({ error: "Access denied to this maintenance ticket" }, { status: 403 });
      }
    } else {
      if (request.organization_id !== auth.organizationId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // 3. Fetch Updates Timeline
    let updatesQuery = supabase
      .from("maintenance_updates")
      .select(`
        *,
        actor:profiles(id, full_name, email)
      `)
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    // Hide internal notes from tenants!
    if (!auth.isOwnerOrManager) {
      updatesQuery = updatesQuery.eq("is_internal_note", false);
    }

    const { data: updates } = await updatesQuery;

    // 4. Generate 15-minute (900s) signed URLs for private photos
    const signedPhotos: Array<{ path: string; signedUrl: string }> = [];
    const photoPaths = (request.photo_paths || []) as string[];

    for (const path of photoPaths) {
      const { data: signedData } = await supabase.storage
        .from("maintenance-photos")
        .createSignedUrl(path, 900);

      if (signedData?.signedUrl) {
        signedPhotos.push({
          path,
          signedUrl: signedData.signedUrl,
        });
      }
    }

    return NextResponse.json({
      request: {
        ...request,
        repair_cost_rupees: paiseToRupees(request.repair_cost_paise),
      },
      updates: updates || [],
      signedPhotos,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = UpdateMaintenanceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Fetch current ticket state
    const { data: currentTicket, error: fetchErr } = await supabase
      .from("maintenance_requests")
      .select(`
        *,
        property:properties(name),
        unit:units(unit_number),
        tenancy:tenancies(
          id,
          tenant:tenants(id, full_name, email)
        )
      `)
      .eq("id", id)
      .single();

    if (fetchErr || !currentTicket) {
      return NextResponse.json({ error: "Maintenance request not found" }, { status: 404 });
    }

    interface TicketTenancy {
      id: string;
      tenant?: { id: string; full_name?: string | null; email?: string | null } | null;
    }

    const ticketTenancy = currentTicket.tenancy as TicketTenancy | null;

    // 2. Authorization and Role Enforcement
    if (!auth.isOwnerOrManager) {
      // Tenant perspective
      const { data: tenantRecord } = await supabase
        .from("tenants")
        .select("id")
        .eq("profile_id", auth.profileId)
        .single();

      if (!tenantRecord || ticketTenancy?.tenant?.id !== tenantRecord.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Tenants cannot set repair cost, internal notes, or paidBy
      if (parsed.data.repairCostRupees !== undefined || parsed.data.paidBy !== undefined || parsed.data.isInternalNote) {
        return NextResponse.json({ error: "Tenants cannot modify financial or internal fields" }, { status: 403 });
      }

      // Tenants can ONLY cancel if currently REPORTED
      if (parsed.data.status) {
        if (parsed.data.status !== "CANCELLED") {
          return NextResponse.json({ error: "Tenants may only cancel their request" }, { status: 403 });
        }
        if (currentTicket.status !== "REPORTED") {
          return NextResponse.json({ error: "Only tickets in REPORTED status can be cancelled by the tenant" }, { status: 400 });
        }
      }
    } else {
      if (currentTicket.organization_id !== auth.organizationId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // 3. Prepare Updates
    interface RequestUpdatePayload {
      status?: string;
      repair_cost_paise?: number;
      paid_by?: string;
      resolution_notes?: string | null;
      resolved_at?: string | null;
      updated_at: string;
    }

    const updatePayload: RequestUpdatePayload = {
      updated_at: new Date().toISOString(),
    };

    const previousStatus = currentTicket.status;
    let newStatus = previousStatus;

    if (parsed.data.status && parsed.data.status !== previousStatus) {
      updatePayload.status = parsed.data.status;
      newStatus = parsed.data.status;

      if (parsed.data.status === "RESOLVED") {
        updatePayload.resolved_at = new Date().toISOString();
      }
    }

    if (auth.isOwnerOrManager) {
      if (parsed.data.repairCostRupees !== undefined) {
        updatePayload.repair_cost_paise = Number(rupeesToPaise(parsed.data.repairCostRupees));
      }
      if (parsed.data.paidBy) {
        updatePayload.paid_by = parsed.data.paidBy;
      }
      if (parsed.data.resolutionNotes !== undefined) {
        updatePayload.resolution_notes = parsed.data.resolutionNotes;
      }
    }

    // Apply updates to maintenance_requests
    const { data: updatedRequest, error: updateErr } = await supabase
      .from("maintenance_requests")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 4. Log to maintenance_updates timeline
    const comment = parsed.data.comment || (newStatus !== previousStatus ? `Status transitioned from ${previousStatus} to ${newStatus}.` : "Maintenance ticket updated.");
    await supabase.from("maintenance_updates").insert({
      organization_id: currentTicket.organization_id,
      request_id: id,
      actor_profile_id: auth.profileId,
      previous_status: previousStatus,
      new_status: newStatus,
      comment,
      is_internal_note: auth.isOwnerOrManager ? (parsed.data.isInternalNote || false) : false,
    });

    // 5. Notifications
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    if (auth.isOwnerOrManager && !parsed.data.isInternalNote) {
      // Notify Tenant in-app
      const { data: tenantProfile } = await supabase
        .from("tenants")
        .select("profile_id, email, full_name")
        .eq("id", currentTicket.tenancy?.tenant?.id)
        .single();

      if (tenantProfile?.profile_id) {
        await createInAppNotification({
          organizationId: currentTicket.organization_id,
          recipientProfileId: tenantProfile.profile_id,
          type: "MAINTENANCE_STATUS_UPDATED",
          title: `Ticket ${newStatus}: ${currentTicket.title}`,
          body: comment,
          linkHref: `/portal/support?id=${id}`,
        });
      }

      // Notify Tenant via Brevo Email
      if (tenantProfile?.email) {
        sendMaintenanceStatusUpdatedToTenantEmail({
          tenantEmail: tenantProfile.email,
          tenantName: tenantProfile.full_name || "Tenant",
          propertyName: (currentTicket.property as { name?: string } | null)?.name || "Rental Property",
          unitCode: (currentTicket.unit as { unit_number?: string } | null)?.unit_number || "Unit",
          ticketTitle: currentTicket.title,
          newStatus,
          comment: parsed.data.comment,
          portalUrl: `${protocol}://${host}/portal/support`,
        }).catch((err) => console.error("Brevo tenant notification warning:", err));
      }
    } else if (!auth.isOwnerOrManager) {
      // Tenant updated/cancelled ticket -> Notify Owner/Manager in-app
      const { data: orgOwners } = await supabase
        .from("organization_memberships")
        .select("profile_id")
        .eq("organization_id", currentTicket.organization_id)
        .in("role", ["OWNER", "MANAGER"]);

      for (const owner of orgOwners || []) {
        await createInAppNotification({
          organizationId: currentTicket.organization_id,
          recipientProfileId: owner.profile_id,
          type: "MAINTENANCE_TENANT_UPDATE",
          title: `Tenant Update on ${currentTicket.title}`,
          body: `Ticket status is now ${newStatus}. ${comment}`,
          linkHref: `/dashboard/owner/maintenance?id=${id}`,
        });
      }
    }

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
