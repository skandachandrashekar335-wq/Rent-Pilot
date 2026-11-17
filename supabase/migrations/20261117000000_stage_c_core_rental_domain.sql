-- ==============================================================================
-- RentPilot — Stage C Migration: Core Rental Domain
-- Properties, Units, Tenants, Tenancies & Rent Increment Schedules
-- ==============================================================================

-- 1. Enable btree_gist extension for PostgreSQL Exclusion Constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Properties Table
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('INDEPENDENT_HOUSE', 'APARTMENT_BUILDING', 'COMMERCIAL', 'OTHER')),
  address_line TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bengaluru',
  state TEXT NOT NULL DEFAULT 'Karnataka',
  pincode TEXT NOT NULL,
  total_floors INT NOT NULL DEFAULT 1,
  facilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_properties_org ON public.properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_archived ON public.properties(is_archived);

-- 3. Units Table
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  floor_number INT NULL,
  configuration_label TEXT NOT NULL DEFAULT '2BHK',
  bedrooms INT NOT NULL DEFAULT 2,
  bathrooms INT NOT NULL DEFAULT 1,
  has_parking BOOLEAN NOT NULL DEFAULT false,
  facilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_rent_paise BIGINT NOT NULL CHECK (base_rent_paise >= 0),
  security_deposit_paise BIGINT NOT NULL DEFAULT 0 CHECK (security_deposit_paise >= 0),
  occupancy_status TEXT NOT NULL DEFAULT 'VACANT' CHECK (occupancy_status IN ('VACANT', 'OCCUPIED', 'MAINTENANCE')),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_property_unit_number UNIQUE (property_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_property ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_org ON public.units(organization_id);
CREATE INDEX IF NOT EXISTS idx_units_occupancy ON public.units(occupancy_status);

-- 4. Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NULL,
  emergency_contact TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tenants_org ON public.tenants(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenants_profile ON public.tenants(profile_id);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON public.tenants(email);

-- 5. Tenancies Table (with Overlap-Prevention GiST Exclusion Constraint)
CREATE TABLE IF NOT EXISTS public.tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  monthly_rent_paise BIGINT NOT NULL CHECK (monthly_rent_paise >= 0),
  security_deposit_paise BIGINT NOT NULL DEFAULT 0 CHECK (security_deposit_paise >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'TERMINATED')),
  termination_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_tenancy_dates CHECK (end_date IS NULL OR end_date > start_date),
  CONSTRAINT no_overlapping_tenancies_per_unit EXCLUDE USING gist (
    unit_id WITH =,
    daterange(start_date, COALESCE(end_date, 'infinity'::date), '[)') WITH &&
  ) WHERE (status IN ('ACTIVE', 'UPCOMING'))
);

CREATE INDEX IF NOT EXISTS idx_tenancies_org ON public.tenancies(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_unit ON public.tenancies(unit_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_tenant ON public.tenancies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_status ON public.tenancies(status);

-- 6. Rent Increment Schedules Table
CREATE TABLE IF NOT EXISTS public.rent_increment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  increment_type TEXT NOT NULL CHECK (increment_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  increment_value NUMERIC(10,2) NOT NULL CHECK (increment_value > 0),
  interval_months INT NOT NULL DEFAULT 12 CHECK (interval_months > 0),
  next_increment_date DATE NOT NULL,
  auto_apply BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_rent_increments_tenancy ON public.rent_increment_schedules(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_rent_increments_org ON public.rent_increment_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_rent_increments_next_date ON public.rent_increment_schedules(next_increment_date);

-- 7. Rent Increment History Table
CREATE TABLE IF NOT EXISTS public.rent_increment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  schedule_id UUID NULL REFERENCES public.rent_increment_schedules(id) ON DELETE SET NULL,
  previous_rent_paise BIGINT NOT NULL CHECK (previous_rent_paise >= 0),
  new_rent_paise BIGINT NOT NULL CHECK (new_rent_paise >= 0),
  effective_date DATE NOT NULL,
  applied_by_profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_rent_history_tenancy ON public.rent_increment_history(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_rent_history_org ON public.rent_increment_history(organization_id);

-- Optional foreign key wire-up for Stage B tenant_invitations to units
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_tenant_invitations_unit'
  ) THEN
    ALTER TABLE public.tenant_invitations 
    ADD CONSTRAINT fk_tenant_invitations_unit 
    FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==============================================================================
-- 8. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all 6 tables
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_increment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_increment_history ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Properties Policies
-- ------------------------------------------------------------------------------
-- Org staff can perform all operations on their properties
CREATE POLICY "properties_manage_org_staff" ON public.properties
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

-- Linked active tenants can view only their own assigned property
CREATE POLICY "properties_select_active_tenant" ON public.properties
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT u.property_id FROM public.units u
      JOIN public.tenancies t ON t.unit_id = u.id
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
        AND t.status IN ('ACTIVE', 'UPCOMING')
    )
  );

-- ------------------------------------------------------------------------------
-- Units Policies
-- ------------------------------------------------------------------------------
-- Org staff can perform all operations on their units
CREATE POLICY "units_manage_org_staff" ON public.units
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

-- Linked active tenants can view only their own assigned unit
CREATE POLICY "units_select_active_tenant" ON public.units
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT t.unit_id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
        AND t.status IN ('ACTIVE', 'UPCOMING')
    )
  );

-- ------------------------------------------------------------------------------
-- Tenants Policies
-- ------------------------------------------------------------------------------
-- Org staff can manage tenants within their organization
CREATE POLICY "tenants_manage_org_staff" ON public.tenants
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

-- Linked tenant can view their own tenant record
CREATE POLICY "tenants_select_own" ON public.tenants
  FOR SELECT TO authenticated
  USING (profile_id = public.get_user_profile_id());

-- ------------------------------------------------------------------------------
-- Tenancies Policies
-- ------------------------------------------------------------------------------
-- Org staff can manage tenancies within their organization
CREATE POLICY "tenancies_manage_org_staff" ON public.tenancies
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

-- Linked tenant can view only their own tenancies
CREATE POLICY "tenancies_select_active_tenant" ON public.tenancies
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE profile_id = public.get_user_profile_id()
    )
  );

-- ------------------------------------------------------------------------------
-- Rent Increment Schedules Policies
-- ------------------------------------------------------------------------------
-- Org staff can manage increment schedules
CREATE POLICY "increment_schedules_manage_org_staff" ON public.rent_increment_schedules
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

-- Linked tenant can view schedules for their own active tenancy
CREATE POLICY "increment_schedules_select_active_tenant" ON public.rent_increment_schedules
  FOR SELECT TO authenticated
  USING (
    tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
  );

-- ------------------------------------------------------------------------------
-- Rent Increment History Policies
-- ------------------------------------------------------------------------------
-- Org staff can manage increment history
CREATE POLICY "increment_history_manage_org_staff" ON public.rent_increment_history
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

-- Linked tenant can view increment history for their own tenancies
CREATE POLICY "increment_history_select_active_tenant" ON public.rent_increment_history
  FOR SELECT TO authenticated
  USING (
    tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
  );
