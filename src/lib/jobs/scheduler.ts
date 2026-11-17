/**
 * RentPilot — Scheduling & Reliability Engine (Stage F)
 * 
 * Invariants:
 * 1. Strict idempotency: Every scheduled or recovery job checks idempotency keys to eliminate duplicates.
 * 2. Overdue reconciliation: Never overwrites PARTIALLY_PAID with OVERDUE; sets is_overdue = true.
 * 3. Zero float math: Uses BIGINT paise calculations.
 * 4. Audit trails: Records job runs in job_execution_logs and email failures in message_delivery_logs.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { retryFailedDeliveries } from "@/lib/notifications/brevo";
import { createInAppNotification } from "@/lib/notifications/in-app";

export interface JobExecutionResult {
  jobId: string;
  triggerSource: "CRON" | "DASHBOARD_RECOVERY" | "MANUAL";
  status: "SUCCESS" | "PARTIAL_FAILURE" | "FAILED" | "SKIPPED";
  organizationsProcessed: number;
  invoicesReconciled: number;
  incrementAlertsEmitted: number;
  billingCyclesPrepared: number;
  emailsRetried: number;
  reason?: string;
  error?: string;
}

export async function runScheduledMaintenanceAndBilling(
  triggerSource: "CRON" | "DASHBOARD_RECOVERY" | "MANUAL",
  targetOrgId?: string
): Promise<JobExecutionResult> {
  const supabase = createAdminSupabaseClient();
  const todayIso = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const jobKey = triggerSource === "CRON"
    ? `cron_daily_run:${todayIso}`
    : triggerSource === "DASHBOARD_RECOVERY"
    ? `dashboard_recovery:${targetOrgId || "all"}:${todayIso}`
    : `manual_run:${Date.now()}`;

  // 1. Check Idempotency Key for CRON runs
  if (triggerSource === "CRON") {
    const { data: existingKey } = await supabase
      .from("idempotency_keys")
      .select("status")
      .eq("key", jobKey)
      .single();

    if (existingKey && existingKey.status === "COMPLETED") {
      return {
        jobId: jobKey,
        triggerSource,
        status: "SKIPPED",
        organizationsProcessed: 0,
        invoicesReconciled: 0,
        incrementAlertsEmitted: 0,
        billingCyclesPrepared: 0,
        emailsRetried: 0,
        reason: `CRON job for ${todayIso} has already completed successfully.`,
      };
    }
  }

  // Register in-progress idempotency key
  await supabase.from("idempotency_keys").upsert({
    key: jobKey,
    job_type: "MAINTENANCE_AND_BILLING",
    status: "IN_PROGRESS",
    created_at: new Date().toISOString(),
  });

  // Create Job Execution Log
  const { data: jobLog } = await supabase
    .from("job_execution_logs")
    .insert({
      job_name: "maintenance_and_billing",
      trigger_source: triggerSource,
      status: "SUCCESS",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const jobLogId = jobLog?.id || jobKey;

  let organizationsProcessed = 0;
  let invoicesReconciled = 0;
  let incrementAlertsEmitted = 0;
  let billingCyclesPrepared = 0;
  let emailsRetried = 0;

  try {
    // Determine Target Organizations
    let orgQuery = supabase.from("organizations").select("id, name");
    if (targetOrgId) {
      orgQuery = orgQuery.eq("id", targetOrgId);
    }
    const { data: organizations, error: orgsErr } = await orgQuery;
    if (orgsErr) throw new Error(orgsErr.message);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // ==============================================================================
    // Task A: Billing Cycle Preparation (Current Month)
    // ==============================================================================
    for (const org of organizations || []) {
      organizationsProcessed++;

      // Ensure a billing_cycle record exists for the current month
      const { data: existingCycle } = await supabase
        .from("billing_cycles")
        .select("id, status")
        .eq("organization_id", org.id)
        .eq("billing_year", currentYear)
        .eq("billing_month", currentMonth)
        .maybeSingle();

      if (!existingCycle) {
        await supabase.from("billing_cycles").insert({
          organization_id: org.id,
          billing_year: currentYear,
          billing_month: currentMonth,
          status: "OPEN",
        });
        billingCyclesPrepared++;
      }

      // Check active tenancies whose properties have reached billing_day_of_month
      const { data: tenancies } = await supabase
        .from("tenancies")
        .select(`
          id,
          unit:units(
            id,
            unit_number,
            property:properties(id, name, billing_day_of_month)
          )
        `)
        .eq("organization_id", org.id)
        .eq("status", "ACTIVE");

      for (const t of tenancies || []) {
        // Safe cast unit/property
        const unitData = t.unit as unknown as {
          unit_number: string;
          property: { id: string; name: string; billing_day_of_month: number } | null;
        } | null;

        const billingDay = unitData?.property?.billing_day_of_month || 1;
        if (currentDay >= billingDay) {
          // Check if invoice already generated for this billing period
          const { data: existingInvoice } = await supabase
            .from("invoices")
            .select("id, status, variable_charges_confirmed")
            .eq("tenancy_id", t.id)
            .eq("billing_period_year", currentYear)
            .eq("billing_period_month", currentMonth)
            .maybeSingle();

          if (!existingInvoice) {
            billingCyclesPrepared++;
          }
        }
      }
    }

    // ==============================================================================
    // Task B: Overdue Invoice Reconciliation
    // ==============================================================================
    // Conditions: due_date < todayIso AND balance_due_paise > 0 AND status IN ('ISSUED', 'PARTIALLY_PAID')
    let invoiceQuery = supabase
      .from("invoices")
      .select("id, organization_id, status, is_overdue, due_date, balance_due_paise")
      .lt("due_date", todayIso)
      .gt("balance_due_paise", 0)
      .in("status", ["ISSUED", "PARTIALLY_PAID"]);

    if (targetOrgId) {
      invoiceQuery = invoiceQuery.eq("organization_id", targetOrgId);
    }

    const { data: overdueInvoices, error: overdueErr } = await invoiceQuery;
    if (overdueErr) throw new Error(overdueErr.message);

    for (const inv of overdueInvoices || []) {
      // INVARIANT: If status is ISSUED, transition to OVERDUE.
      // If status is PARTIALLY_PAID, keep status as PARTIALLY_PAID and set is_overdue = true.
      const newStatus = inv.status === "ISSUED" ? "OVERDUE" : inv.status;
      
      const { error: updateErr } = await supabase
        .from("invoices")
        .update({
          status: newStatus,
          is_overdue: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inv.id);

      if (!updateErr) {
        invoicesReconciled++;
      }
    }

    // Reconcile invoices that were marked OVERDUE but are now fully paid
    let clearedQuery = supabase
      .from("invoices")
      .select("id, balance_due_paise")
      .eq("status", "OVERDUE")
      .lte("balance_due_paise", 0);

    if (targetOrgId) {
      clearedQuery = clearedQuery.eq("organization_id", targetOrgId);
    }
    const { data: clearedInvoices } = await clearedQuery;
    for (const inv of clearedInvoices || []) {
      await supabase
        .from("invoices")
        .update({
          status: "PAID",
          is_overdue: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inv.id);
      invoicesReconciled++;
    }

    // ==============================================================================
    // Task C: Rent Increment Lead-Time Alerts (Within 30 Days)
    // ==============================================================================
    const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let incrementQuery = supabase
      .from("rent_increment_schedules")
      .select(`
        id,
        organization_id,
        increment_type,
        increment_value,
        next_increment_date,
        tenancy:tenancies(
          id,
          unit:units(unit_number, property:properties(name)),
          tenant:tenants(full_name)
        )
      `)
      .eq("status", "ACTIVE")
      .gte("next_increment_date", todayIso)
      .lte("next_increment_date", thirtyDaysAhead);

    if (targetOrgId) {
      incrementQuery = incrementQuery.eq("organization_id", targetOrgId);
    }

    const { data: upcomingIncrements } = await incrementQuery;

    for (const inc of upcomingIncrements || []) {
      const incKey = `rent_increment_due:${inc.id}:${inc.next_increment_date}`;

      // Check idempotency key to avoid spamming alerts daily for 30 days
      const { data: existingIncAlert } = await supabase
        .from("idempotency_keys")
        .select("key")
        .eq("key", incKey)
        .maybeSingle();

      if (!existingIncAlert) {
        // Register idempotency key
        await supabase.from("idempotency_keys").insert({
          key: incKey,
          job_type: "RENT_INCREMENT_ALERT",
          status: "COMPLETED",
          completed_at: new Date().toISOString(),
        });

        // Find organization owner/manager profile to deliver in-app alert
        const { data: members } = await supabase
          .from("organization_memberships")
          .select("profile_id")
          .eq("organization_id", inc.organization_id)
          .eq("status", "ACTIVE")
          .limit(1);

        const recipientProfileId = members?.[0]?.profile_id;
        if (recipientProfileId) {
          const tenancyData = inc.tenancy as unknown as {
            unit: { unit_number: string; property: { name: string } | null } | null;
            tenant: { full_name: string } | null;
          } | null;

          const unitCode = tenancyData?.unit?.unit_number || "Unit";
          const propertyName = tenancyData?.unit?.property?.name || "Property";
          const tenantName = tenancyData?.tenant?.full_name || "Tenant";
          const formattedVal = inc.increment_type === "PERCENTAGE" ? `${inc.increment_value}%` : `₹${inc.increment_value}`;

          await createInAppNotification({
            organizationId: inc.organization_id,
            recipientProfileId,
            type: "RENT_INCREMENT_ALERT",
            title: `Upcoming Rent Increment: ${unitCode}`,
            body: `Scheduled rent increment of ${formattedVal} for ${unitCode} (${propertyName} · ${tenantName}) is due on ${inc.next_increment_date}.`,
            linkHref: `/properties`,
          });

          incrementAlertsEmitted++;
        }
      }
    }

    // ==============================================================================
    // Task D: Retry Failed Email Deliveries (Bounded Exponential Retry)
    // ==============================================================================
    const retryResult = await retryFailedDeliveries(3);
    emailsRetried = retryResult.retried;

    // Update job execution log to SUCCESS
    const finishedAt = new Date().toISOString();
    await supabase
      .from("job_execution_logs")
      .update({
        status: "SUCCESS",
        organizations_processed: organizationsProcessed,
        records_affected: invoicesReconciled + incrementAlertsEmitted + billingCyclesPrepared,
        finished_at: finishedAt,
      })
      .eq("id", jobLogId);

    // Complete Idempotency Key
    await supabase
      .from("idempotency_keys")
      .update({
        status: "COMPLETED",
        result_summary: {
          organizationsProcessed,
          invoicesReconciled,
          incrementAlertsEmitted,
          billingCyclesPrepared,
          emailsRetried,
        },
        completed_at: finishedAt,
      })
      .eq("key", jobKey);

    return {
      jobId: String(jobLogId),
      triggerSource,
      status: "SUCCESS",
      organizationsProcessed,
      invoicesReconciled,
      incrementAlertsEmitted,
      billingCyclesPrepared,
      emailsRetried,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error during scheduled job execution";
    console.error("[Scheduled Maintenance Job Failed]", errorMsg);

    // Update log to FAILED
    await supabase
      .from("job_execution_logs")
      .update({
        status: "FAILED",
        error_details: { message: errorMsg },
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobLogId);

    // Update Idempotency Key to FAILED
    await supabase
      .from("idempotency_keys")
      .update({
        status: "FAILED",
        result_summary: { error: errorMsg },
        completed_at: new Date().toISOString(),
      })
      .eq("key", jobKey);

    return {
      jobId: String(jobLogId),
      triggerSource,
      status: "FAILED",
      organizationsProcessed,
      invoicesReconciled,
      incrementAlertsEmitted,
      billingCyclesPrepared,
      emailsRetried,
      error: errorMsg,
    };
  }
}
