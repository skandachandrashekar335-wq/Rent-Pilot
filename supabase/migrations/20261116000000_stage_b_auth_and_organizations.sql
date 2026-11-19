-- ==============================================================================
-- RentPilot — Stage B Migration: Identity, Organizations & Invitations
-- ==============================================================================

-- 1. Helper Functions for Firebase Auth & Profile Resolution
CREATE OR REPLACE FUNCTION public.current_firebase_uid() 
RETURNS TEXT STABLE SECURITY DEFINER SET search_path = public, pg_temp LANGUAGE sql AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'sub'),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
  );
$$;

-- 2. Profiles Table (Linked to Firebase UID)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  photo_url TEXT,
  preferred_locale TEXT NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en', 'kn', 'hi')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE OR REPLACE FUNCTION public.get_user_profile_id()
RETURNS UUID STABLE SECURITY DEFINER SET search_path = public, pg_temp LANGUAGE sql AS $$
  SELECT id FROM public.profiles WHERE firebase_uid = public.current_firebase_uid() LIMIT 1;
$$;

-- 3. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  billing_day_of_month INT NOT NULL DEFAULT 10 CHECK (billing_day_of_month BETWEEN 1 AND 28),
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_profile_id);

-- 4. Organization Memberships Table
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_organization_profile UNIQUE (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_profile_id ON public.organization_memberships(profile_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON public.organization_memberships(organization_id);

-- 5. Tenant Invitations Table
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id UUID NULL, -- Stage C foreign key placeholder
  invited_email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON public.tenant_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON public.tenant_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_org ON public.tenant_invitations(organization_id);

-- ==============================================================================
-- 6. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
-- User can view their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (firebase_uid = public.current_firebase_uid());

-- User can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (firebase_uid = public.current_firebase_uid())
  WITH CHECK (firebase_uid = public.current_firebase_uid());

-- Organization owners/managers can view profiles of their members
CREATE POLICY "profiles_select_colleagues" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT om.profile_id 
      FROM public.organization_memberships om
      WHERE om.organization_id IN (
        SELECT my_om.organization_id 
        FROM public.organization_memberships my_om 
        WHERE my_om.profile_id = public.get_user_profile_id()
      )
    )
  );

-- ------------------------------------------------------------------------------
-- Organizations Policies
-- ------------------------------------------------------------------------------
-- Members can view their organization
CREATE POLICY "organizations_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.organization_memberships 
      WHERE profile_id = public.get_user_profile_id()
    )
  );

-- Authenticated user can create an organization as owner
CREATE POLICY "organizations_insert_owner" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_profile_id = public.get_user_profile_id());

-- Only owner can update organization details
CREATE POLICY "organizations_update_owner" ON public.organizations
  FOR UPDATE TO authenticated
  USING (owner_profile_id = public.get_user_profile_id())
  WITH CHECK (owner_profile_id = public.get_user_profile_id());

-- ------------------------------------------------------------------------------
-- Organization Memberships Policies
-- ------------------------------------------------------------------------------
-- Members can view memberships within their organization
CREATE POLICY "org_memberships_select_member" ON public.organization_memberships
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_memberships 
      WHERE profile_id = public.get_user_profile_id()
    )
  );

-- Only owners can insert/update/delete memberships
CREATE POLICY "org_memberships_manage_owner" ON public.organization_memberships
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_memberships 
      WHERE profile_id = public.get_user_profile_id() AND role = 'OWNER'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_memberships 
      WHERE profile_id = public.get_user_profile_id() AND role = 'OWNER'
    )
  );

-- ------------------------------------------------------------------------------
-- Tenant Invitations Policies
-- ------------------------------------------------------------------------------
-- Owners and Managers can view invitations for their organization
CREATE POLICY "tenant_invitations_select_org_staff" ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_memberships 
      WHERE profile_id = public.get_user_profile_id() AND role IN ('OWNER', 'MANAGER')
    )
  );

-- Only Owners can create or revoke invitations
CREATE POLICY "tenant_invitations_manage_owner" ON public.tenant_invitations
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_memberships 
      WHERE profile_id = public.get_user_profile_id() AND role = 'OWNER'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_memberships 
      WHERE profile_id = public.get_user_profile_id() AND role = 'OWNER'
    )
  );

-- Invitee can view invitation matching their verified email address
CREATE POLICY "tenant_invitations_select_invitee" ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (
    invited_email = (
      SELECT email FROM public.profiles WHERE id = public.get_user_profile_id()
    )
  );
