-- ==============================================================================
-- RentPilot — Stage E Migration: Maintenance Requests, Updates, Storage & Notifications
-- ==============================================================================

-- 1. Maintenance Requests Table
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  reported_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('PLUMBING', 'ELECTRICAL', 'APPLIANCE', 'CARPENTRY', 'STRUCTURAL', 'PEST_CONTROL', 'OTHER')),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')),
  photo_paths TEXT[] NOT NULL DEFAULT '{}',
  repair_cost_paise BIGINT NOT NULL DEFAULT 0 CHECK (repair_cost_paise >= 0),
  paid_by TEXT NOT NULL DEFAULT 'OWNER' CHECK (paid_by IN ('OWNER', 'TENANT', 'SHARED')),
  resolution_notes TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_maint_requests_org ON public.maintenance_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_prop ON public.maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_unit ON public.maintenance_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_tenancy ON public.maintenance_requests(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_maint_requests_status ON public.maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maint_requests_priority ON public.maintenance_requests(priority);

-- 2. Maintenance Updates & Activity Timeline
CREATE TABLE IF NOT EXISTS public.maintenance_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_status TEXT NULL,
  new_status TEXT NULL,
  comment TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_maint_updates_req ON public.maintenance_updates(request_id);
CREATE INDEX IF NOT EXISTS idx_maint_updates_org ON public.maintenance_updates(organization_id);

-- 3. In-App Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_href TEXT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(recipient_profile_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);

-- 4. Private Storage Bucket Setup for Maintenance Photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-photos',
  'maintenance-photos',
  false,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage Policies for Private 'maintenance-photos' Bucket
CREATE POLICY "maint_photos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'maintenance-photos');

CREATE POLICY "maint_photos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'maintenance-photos');

-- ==============================================================================
-- 5. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Maintenance Requests Policies
CREATE POLICY "maint_requests_manage_org_staff" ON public.maintenance_requests
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  );

CREATE POLICY "maint_requests_select_tenant" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
  );

CREATE POLICY "maint_requests_insert_tenant" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
    AND reported_by_profile_id = public.get_user_profile_id()
  );

CREATE POLICY "maint_requests_cancel_tenant" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
    AND status = 'REPORTED'
  )
  WITH CHECK (
    status = 'CANCELLED'
  );

-- Maintenance Updates Policies
CREATE POLICY "maint_updates_manage_org_staff" ON public.maintenance_updates
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  );

CREATE POLICY "maint_updates_select_tenant" ON public.maintenance_updates
  FOR SELECT TO authenticated
  USING (
    is_internal_note = false
    AND request_id IN (
      SELECT mr.id FROM public.maintenance_requests mr
      JOIN public.tenancies t ON t.id = mr.tenancy_id
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
  );

CREATE POLICY "maint_updates_insert_tenant" ON public.maintenance_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal_note = false
    AND actor_profile_id = public.get_user_profile_id()
    AND request_id IN (
      SELECT mr.id FROM public.maintenance_requests mr
      JOIN public.tenancies t ON t.id = mr.tenancy_id
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
  );

-- Notifications Policies
CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    recipient_profile_id = public.get_user_profile_id()
  );

CREATE POLICY "notifications_update_recipient" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    recipient_profile_id = public.get_user_profile_id()
  )
  WITH CHECK (
    recipient_profile_id = public.get_user_profile_id()
  );

CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
    OR recipient_profile_id = public.get_user_profile_id()
  );
