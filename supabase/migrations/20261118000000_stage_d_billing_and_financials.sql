-- ==============================================================================
-- RentPilot — Stage D Migration: Billing, Invoices, UPI Payments & Audit
-- ==============================================================================

-- 1. Extend Organizations with UPI & Billing Settings
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS upi_vpa TEXT DEFAULT 'rentpilot@okhdfcbank',
  ADD COLUMN IF NOT EXISTS upi_payee_name TEXT DEFAULT 'RentPilot Properties',
  ADD COLUMN IF NOT EXISTS default_due_days INT DEFAULT 5;

-- 2. Billing Cycles Table
CREATE TABLE IF NOT EXISTS public.billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_year INT NOT NULL,
  billing_month INT NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ISSUED', 'CLOSED')),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  issued_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_org_billing_cycle UNIQUE (organization_id, billing_year, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_billing_cycles_org ON public.billing_cycles(organization_id);

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_cycle_id UUID NULL REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE RESTRICT,
  invoice_number TEXT UNIQUE NOT NULL,
  billing_period_year INT NOT NULL,
  billing_period_month INT NOT NULL CHECK (billing_period_month BETWEEN 1 AND 12),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  rent_paise BIGINT NOT NULL CHECK (rent_paise >= 0),
  electricity_paise BIGINT NOT NULL DEFAULT 0 CHECK (electricity_paise >= 0),
  water_paise BIGINT NOT NULL DEFAULT 0 CHECK (water_paise >= 0),
  maintenance_paise BIGINT NOT NULL DEFAULT 0 CHECK (maintenance_paise >= 0),
  other_charges_paise BIGINT NOT NULL DEFAULT 0 CHECK (other_charges_paise >= 0),
  previous_balance_paise BIGINT NOT NULL DEFAULT 0 CHECK (previous_balance_paise >= 0),
  credits_paise BIGINT NOT NULL DEFAULT 0 CHECK (credits_paise >= 0),
  total_due_paise BIGINT NOT NULL CHECK (total_due_paise >= 0),
  amount_paid_paise BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid_paise >= 0),
  balance_due_paise BIGINT NOT NULL CHECK (balance_due_paise >= 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')),
  is_overdue BOOLEAN NOT NULL DEFAULT false,
  variable_charges_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_tenancy_billing_period UNIQUE (tenancy_id, billing_period_year, billing_period_month)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenancy ON public.invoices(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);

-- 4. Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('RENT', 'ELECTRICITY', 'WATER', 'MAINTENANCE', 'OTHER', 'ARREARS', 'CREDIT', 'ADJUSTMENT')),
  label TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- 5. Payment Submissions Table (Proof Uploads from Tenants)
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  submitted_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  payment_method TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI')),
  raw_reference TEXT NOT NULL,
  normalized_reference TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED')),
  rejection_reason TEXT NULL,
  reviewed_by_profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_submissions_invoice ON public.payment_submissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_org ON public.payment_submissions(organization_id);

-- Partial Unique Index for Active/Verified Payment References
-- Releasing rejected submissions for resubmission while preventing double-claims
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_payment_ref 
ON public.payment_submissions (organization_id, normalized_reference) 
WHERE status IN ('PENDING_REVIEW', 'VERIFIED');

-- 6. Payments Ledger Table (Immutable Financial Transactions)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE RESTRICT,
  submission_id UUID NULL REFERENCES public.payment_submissions(id) ON DELETE SET NULL,
  amount_paise BIGINT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'CASH', 'CHEQUE', 'BANK_TRANSFER', 'REVERSAL')),
  payment_date DATE NOT NULL,
  normalized_reference TEXT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  recorded_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenancy ON public.payments(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_payments_receipt ON public.payments(receipt_number);

-- 7. Financial Audit Logs Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  before_state JSONB NULL,
  after_state JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.financial_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.financial_audit_logs(organization_id);

-- 8. Private Storage Bucket Setup for Payment Receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage Policies for Private 'receipts' Bucket
CREATE POLICY "receipts_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

-- ==============================================================================
-- 9. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Billing Cycles Policies
CREATE POLICY "billing_cycles_manage_org_staff" ON public.billing_cycles
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

-- Invoices Policies
CREATE POLICY "invoices_manage_org_staff" ON public.invoices
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

CREATE POLICY "invoices_select_tenant" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
    AND status != 'DRAFT'
  );

-- Invoice Items Policies
CREATE POLICY "invoice_items_manage_org_staff" ON public.invoice_items
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

CREATE POLICY "invoice_items_select_tenant" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.tenancies t ON t.id = i.tenancy_id
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
        AND i.status != 'DRAFT'
    )
  );

-- Payment Submissions Policies
CREATE POLICY "submissions_manage_org_staff" ON public.payment_submissions
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

CREATE POLICY "submissions_select_tenant" ON public.payment_submissions
  FOR SELECT TO authenticated
  USING (submitted_by_profile_id = public.get_user_profile_id());

CREATE POLICY "submissions_insert_tenant" ON public.payment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by_profile_id = public.get_user_profile_id()
    AND status = 'PENDING_REVIEW'
    AND tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
  );

-- Payments Ledger Policies
CREATE POLICY "payments_manage_org_staff" ON public.payments
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

CREATE POLICY "payments_select_tenant" ON public.payments
  FOR SELECT TO authenticated
  USING (
    tenancy_id IN (
      SELECT t.id FROM public.tenancies t
      JOIN public.tenants tn ON tn.id = t.tenant_id
      WHERE tn.profile_id = public.get_user_profile_id()
    )
  );

-- Financial Audit Logs Policies
CREATE POLICY "audit_logs_select_org_staff" ON public.financial_audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  );

CREATE POLICY "audit_logs_insert_authenticated" ON public.financial_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  );
