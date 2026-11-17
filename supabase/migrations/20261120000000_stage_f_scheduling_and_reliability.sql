-- ==============================================================================
-- RentPilot — Stage F Migration: Scheduling, Idempotency, Reliability & Logs
-- ==============================================================================

-- 1. Idempotency Keys Table
-- Guarantees once-and-only-once execution across scheduled cron, manual, and dashboard triggers
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  result_summary JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_job_type ON public.idempotency_keys(job_type);
CREATE INDEX IF NOT EXISTS idx_idempotency_status ON public.idempotency_keys(status);

-- 2. Job Execution Logs Table
-- System audit trail tracking all scheduled maintenance runs and demand-driven recoveries
CREATE TABLE IF NOT EXISTS public.job_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('CRON', 'DASHBOARD_RECOVERY', 'MANUAL')),
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL_FAILURE', 'FAILED')),
  organizations_processed INT NOT NULL DEFAULT 0,
  records_affected INT NOT NULL DEFAULT 0,
  error_details JSONB NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  finished_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_job_logs_name ON public.job_execution_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_logs_started ON public.job_execution_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_status ON public.job_execution_logs(status);

-- 3. Message Delivery Logs Table
-- Tracks transactional email attempts, failures, and bounded retry state
CREATE TABLE IF NOT EXISTS public.message_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  template_name TEXT NOT NULL,
  reference_entity_type TEXT NULL,
  reference_entity_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  attempt_count INT NOT NULL DEFAULT 1,
  last_error TEXT NULL,
  next_retry_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_org ON public.message_delivery_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON public.message_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_retry ON public.message_delivery_logs(status, next_retry_at);

-- ==============================================================================
-- 4. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Idempotency Keys: Staff can view; service role / functions manage
CREATE POLICY "idempotency_keys_select_authenticated" ON public.idempotency_keys
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "idempotency_keys_insert_authenticated" ON public.idempotency_keys
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "idempotency_keys_update_authenticated" ON public.idempotency_keys
  FOR UPDATE TO authenticated
  USING (true);

-- Job Execution Logs: Staff can view logs
CREATE POLICY "job_execution_logs_select_authenticated" ON public.job_execution_logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "job_execution_logs_insert_authenticated" ON public.job_execution_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Message Delivery Logs: Scoped to organization membership
CREATE POLICY "delivery_logs_select_org_staff" ON public.message_delivery_logs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  );

CREATE POLICY "delivery_logs_insert_authenticated" ON public.message_delivery_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  );

CREATE POLICY "delivery_logs_update_authenticated" ON public.message_delivery_logs
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE profile_id = public.get_user_profile_id()
    )
  );

-- ==============================================================================
-- 5. Ready-to-Enable pg_cron + pg_net Daily Schedule Snippet
-- ==============================================================================
-- In Supabase Cloud Dashboard (Database -> Extensions), enable pg_cron and pg_net.
-- Then execute the snippet below in SQL Editor to schedule daily execution at 08:00 IST (02:30 UTC):
--
-- SELECT cron.schedule(
--   'rentpilot-daily-scheduled-jobs',
--   '30 2 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://your-rentpilot-domain.vercel.app/api/cron/run',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
--     ),
--     body := jsonb_build_object('source', 'PG_CRON')
--   ) AS request_id;
--   $$
-- );
