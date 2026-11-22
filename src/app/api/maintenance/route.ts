import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CreateMaintenanceRequestSchema } from "@/lib/validation/maintenance";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { sendMaintenanceReportedToOwnerEmail } from "@/lib/notifications/brevo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const priorityFilter = searchParams.get("priority");
    const propertyIdFilter = searchParams.get("propertyId");

    const supabase = createAdminSupabaseClient();

    if (auth.isOwnerOrManager) {
      let query = supabase
        .from("maintenance_requests")
        .select(`
          *,
          property:properties(id, name),
          unit:units(id, unit_number, configuration_label),
          tenancy:tenancies(
            id,
            tenant:tenants(id, full_name, email, phone)
          ),
          reported_by:profiles(id, full_name, email)
        `)
        .eq("organization_id", auth.organizationId!)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }
      if (priorityFilter && priorityFilter !== "ALL") {
        query = query.eq("priority", priorityFilter);
      }
      if (propertyIdFilter && propertyIdFilter !== "ALL") {
        query = query.eq("property_id", propertyIdFilter);
      }

      const { data: requests, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ requests: requests || [] });
    } else {
      // Tenant perspective: Find active tenancies linked to tenant's profile or email in a single query
      const { data: tenantRecord } = await supabase
        .from("tenants")
        .select("id")
        .or(`profile_id.eq.${auth.profileId},email.ilike.${auth.email}`)
        .limit(1)
        .maybeSingle();

      if (!tenantRecord) {
        return NextResponse.json({ requests: [] });
      }

      const { data: tenancies } = await supabase
        .from("tenancies")
        .select("id")
        .eq("tenant_id", tenantRecord.id);

      const tenancyIds = (tenancies || []).map((t) => t.id);
      if (tenancyIds.length === 0) {
        return NextResponse.json({ requests: [] });
      }

      let query = supabase
        .from("maintenance_requests")
        .select(`
          *,
          property:properties(id, name),
          unit:units(id, unit_number, configuration_label)
        `)
        .in("tenancy_id", tenancyIds)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }

      const { data: requests, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ requests: requests || [] });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = CreateMaintenanceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Determine tenancy, unit, property, and organization
    let tenancyId = parsed.data.tenancyId;
    interface TenancyLookup {
      id: string;
      organization_id: string;
      property_id?: string;
      unit_id: string;
      unit?: {
        id: string;
        unit_number: string;
        property_id: string;
        property?: {
          id: string;
          name: string;
        } | null;
      } | null;
      tenant?: {
        id: string;
        full_name: string;
        email: string | null;
      } | null;
    }

    let tenancy: TenancyLookup | null = null;

    if (auth.isOwnerOrManager && tenancyId) {
      const { data: t } = await supabase
        .from("tenancies")
        .select(`
          id,
          organization_id,
          unit_id,
          unit:units(id, unit_number, property_id, property:properties(id, name)),
          tenant:tenants(id, full_name, email)
        `)
        .eq("id", tenancyId)
        .eq("organization_id", auth.organizationId!)
        .single();
      tenancy = t as unknown as TenancyLookup;
    } else {
      // Find tenant's active tenancy
      const { data: tenantRecord } = await supabase
        .from("tenants")
        .select("id, full_name, email")
        .eq("profile_id", auth.profileId)
        .single();

      if (!tenantRecord) {
        return NextResponse.json({ error: "No tenant record associated with this account" }, { status: 404 });
      }

      const { data: t } = await supabase
        .from("tenancies")
        .select(`
          id,
          organization_id,
          unit_id,
          unit:units(id, unit_number, property_id, property:properties(id, name)),
          tenant:tenants(id, full_name, email)
        `)
        .eq("tenant_id", tenantRecord.id)
        .in("status", ["ACTIVE", "UPCOMING"])
        .order("start_date", { ascending: false })
        .limit(1)
        .single();

      tenancy = t as unknown as TenancyLookup;
    }

    if (!tenancy || !tenancy.unit) {
      return NextResponse.json({ error: "No active tenancy found to associate with this request" }, { status: 400 });
    }

    const organizationId = tenancy.organization_id;
    const propertyId = tenancy.unit.property_id;
    const unitId = tenancy.unit_id;
    tenancyId = tenancy.id;

    // Insert maintenance request
    const { data: request, error: reqErr } = await supabase
      .from("maintenance_requests")
      .insert({
        organization_id: organizationId,
        property_id: propertyId,
        unit_id: unitId,
        tenancy_id: tenancyId,
        reported_by_profile_id: auth.profileId,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        priority: parsed.data.priority,
        photo_paths: parsed.data.photoPaths || [],
        status: "REPORTED",
        repair_cost_paise: 0,
        paid_by: "OWNER",
      })
      .select()
      .single();

    if (reqErr || !request) {
      return NextResponse.json({ error: reqErr?.message || "Failed to create maintenance request" }, { status: 500 });
    }

    // Insert initial activity log in maintenance_updates
    await supabase.from("maintenance_updates").insert({
      organization_id: organizationId,
      request_id: request.id,
      actor_profile_id: auth.profileId,
      previous_status: null,
      new_status: "REPORTED",
      comment: "Ticket created and reported by tenant.",
      is_internal_note: false,
    });

    // Notify organization owners/managers in-app & via Brevo email
    const { data: orgMembers } = await supabase
      .from("organization_memberships")
      .select("profile_id, role, profile:profiles(id, full_name, email)")
      .eq("organization_id", organizationId)
      .in("role", ["OWNER", "MANAGER"]);

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const dashboardUrl = `${protocol}://${host}/dashboard/owner/maintenance`;

    interface MemberProfile {
      profile_id: string;
      profile?: { id: string; full_name: string; email: string | null } | null;
    }

    const typedMembers = (orgMembers || []) as unknown as MemberProfile[];

    for (const m of typedMembers) {
      // In-app notification
      await createInAppNotification({
        organizationId,
        recipientProfileId: m.profile_id,
        type: "MAINTENANCE_REPORTED",
        title: `[${request.priority}] ${request.title}`,
        body: `New ${request.category} request for Unit ${tenancy.unit.unit_number} (${tenancy.unit.property?.name || "Property"}).`,
        linkHref: `/dashboard/owner/maintenance?id=${request.id}`,
      });

      // Brevo email notification to owner/manager
      if (m.profile?.email) {
        sendMaintenanceReportedToOwnerEmail({
          ownerEmail: m.profile.email,
          ownerName: m.profile.full_name || "Property Manager",
          tenantName: tenancy.tenant?.full_name || "Tenant",
          propertyName: tenancy.unit.property?.name || "Rental Property",
          unitCode: tenancy.unit.unit_number,
          ticketTitle: request.title,
          category: request.category,
          priority: request.priority,
          description: request.description,
          photoCount: (request.photo_paths || []).length,
          dashboardUrl,
        }).catch((err) => console.error("Brevo owner notification warning:", err));
      }
    }

    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
