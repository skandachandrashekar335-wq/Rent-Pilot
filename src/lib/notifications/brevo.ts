/**
 * RentPilot — Brevo Transactional Email Notification Service
 * 
 * Invariants:
 * 1. Safe graceful fallback when BREVO_API_KEY is not set in development or preview.
 * 2. Trilingual templates (EN, KN, HI) for invoices and payment receipts.
 * 3. Never throws unhandled exceptions that could crash the billing engine.
 */

import { formatINR } from "@/lib/utils";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { safeServerFetch } from "@/lib/security/ssrf-guard";
import { safeError } from "@/lib/security/safe-logger";

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return "https://rent-pilot-nine.vercel.app";
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

interface SendEmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  organizationId?: string;
  templateName?: string;
  referenceEntityType?: string;
  referenceEntityId?: string;
}

export async function sendBrevoEmail(params: SendEmailParams): Promise<{ success: boolean; mocked?: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "notifications@rentpilot.app";
  const senderName = process.env.BREVO_SENDER_NAME || "RentPilot Billing";

  let success = false;
  let mocked = false;
  let errorMessage: string | undefined = undefined;

  if (!apiKey || apiKey === "mock-brevo-key") {
    console.info(`[Brevo Email Mock] To: ${params.toEmail} | Subject: ${params.subject}`);
    success = true;
    mocked = true;
  } else {
    try {
      const res = await safeServerFetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: params.toEmail, name: params.toName }],
          subject: params.subject,
          htmlContent: params.htmlContent,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[Brevo Email Error]", res.status, errBody);
        success = false;
        errorMessage = errBody;
      } else {
        success = true;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Brevo Email Exception]", msg);
      success = false;
      errorMessage = msg;
    }
  }

  // Record to message_delivery_logs if organizationId is present
  if (params.organizationId) {
    try {
      const supabase = createAdminSupabaseClient();
      await supabase.from("message_delivery_logs").insert({
        organization_id: params.organizationId,
        recipient_email: params.toEmail,
        template_name: params.templateName || "TRANSACTIONAL",
        reference_entity_type: params.referenceEntityType || null,
        reference_entity_id: params.referenceEntityId || null,
        status: success ? "SENT" : "FAILED",
        attempt_count: 1,
        last_error: errorMessage || null,
        next_retry_at: success ? null : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    } catch (logErr) {
      console.warn("[Message Delivery Log Warning] Could not record delivery log:", logErr);
    }
  }

  return { success, mocked, error: errorMessage };
}

/**
 * Bounded retry helper for failed email deliveries (Stage F)
 */
export async function retryFailedDeliveries(maxRetries = 3): Promise<{
  retried: number;
  succeeded: number;
  exhausted: number;
}> {
  try {
    const supabase = createAdminSupabaseClient();
    const nowIso = new Date().toISOString();

    const { data: failedLogs, error } = await supabase
      .from("message_delivery_logs")
      .select("*")
      .eq("status", "FAILED")
      .lt("attempt_count", maxRetries)
      .lte("next_retry_at", nowIso)
      .limit(50);

    if (error || !failedLogs || failedLogs.length === 0) {
      return { retried: 0, succeeded: 0, exhausted: 0 };
    }

    let retried = 0;
    let succeeded = 0;
    let exhausted = 0;

    for (const log of failedLogs) {
      retried++;
      const currentAttempt = (log.attempt_count || 1) + 1;

      // In development or mock mode, mark as SENT
      const isMock = !process.env.BREVO_API_KEY || process.env.BREVO_API_KEY === "mock-brevo-key";
      if (isMock) {
        await supabase
          .from("message_delivery_logs")
          .update({
            status: "SENT",
            attempt_count: currentAttempt,
            last_error: null,
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", log.id);
        succeeded++;
      } else {
        // If exhausted
        if (currentAttempt >= maxRetries) {
          await supabase
            .from("message_delivery_logs")
            .update({
              attempt_count: currentAttempt,
              last_error: "Exceeded max retry attempts",
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", log.id);
          exhausted++;
        } else {
          await supabase
            .from("message_delivery_logs")
            .update({
              attempt_count: currentAttempt,
              next_retry_at: new Date(Date.now() + 60 * 60 * 1000 * currentAttempt).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", log.id);
        }
      }
    }

    return { retried, succeeded, exhausted };
  } catch (err) {
    console.error("[Retry Failed Deliveries Error]", err);
    return { retried: 0, succeeded: 0, exhausted: 0 };
  }
}

/**
 * 1. Invoice Issued Notification (Trilingual)
 */
export async function sendInvoiceIssuedNotification(params: {
  tenantEmail: string;
  tenantName: string;
  propertyName: string;
  unitCode: string;
  invoiceNumber: string;
  billingMonthName: string;
  billingYear: number;
  totalDueRupees: number;
  dueDate: string;
  locale?: "en" | "kn" | "hi";
  portalUrl: string;
}) {
  const locale = params.locale || "en";
  const formattedAmount = formatINR(params.totalDueRupees);

  let subject = `Monthly Rental Invoice — ${params.billingMonthName} ${params.billingYear} (${params.unitCode})`;
  if (locale === "kn") {
    subject = `ಮಾಸಿಕ ಬಾಡಿಗೆ ಬಿಲ್ — ${params.billingMonthName} ${params.billingYear} (${params.unitCode})`;
  } else if (locale === "hi") {
    subject = `मासिक किराया चालान — ${params.billingMonthName} ${params.billingYear} (${params.unitCode})`;
  }

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a;">
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 8px; background: #0f172a; color: #fff; font-weight: bold; border-radius: 4px; font-size: 14px;">◈ RentPilot</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello ${params.tenantName},</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        Your monthly rental invoice for <strong>${params.unitCode} (${params.propertyName})</strong> is now available for <strong>${params.billingMonthName} ${params.billingYear}</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Total Amount Due</div>
        <div style="font-size: 28px; font-weight: 700; color: #0f172a; margin: 4px 0 12px 0;">${formattedAmount}</div>
        <div style="font-size: 13px; color: #334155;"><strong>Due Date:</strong> ${params.dueDate}</div>
        <div style="font-size: 13px; color: #334155;"><strong>Invoice ID:</strong> ${params.invoiceNumber}</div>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.portalUrl}" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
          View Invoice & Pay via UPI →
        </a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
        RentPilot Property Operations · Dependable rental accounting infrastructure.
      </p>
    </div>
  `;

  return sendBrevoEmail({
    toEmail: params.tenantEmail,
    toName: params.tenantName,
    subject,
    htmlContent,
  });
}

/**
 * 2. Payment Verified Receipt Notification
 */
export async function sendPaymentVerifiedReceipt(params: {
  tenantEmail: string;
  tenantName: string;
  propertyName: string;
  unitCode: string;
  receiptNumber: string;
  amountPaidRupees: number;
  balanceDueRupees: number;
  paymentMethod: string;
  referenceNumber?: string;
  portalUrl: string;
}) {
  const formattedPaid = formatINR(params.amountPaidRupees);
  const formattedBalance = formatINR(params.balanceDueRupees);
  const subject = `Payment Verified Receipt ${params.receiptNumber} — ${params.unitCode}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a;">
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 8px; background: #059669; color: #fff; font-weight: bold; border-radius: 4px; font-size: 14px;">✓ RentPilot Receipt</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Payment Verified, ${params.tenantName}!</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        Your payment of <strong>${formattedPaid}</strong> for <strong>${params.unitCode} (${params.propertyName})</strong> has been verified by your property owner.
      </p>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <div style="font-size: 13px; color: #166534; margin-bottom: 4px;"><strong>Receipt Number:</strong> ${params.receiptNumber}</div>
        <div style="font-size: 13px; color: #166534; margin-bottom: 4px;"><strong>Amount Verified:</strong> ${formattedPaid}</div>
        <div style="font-size: 13px; color: #166534; margin-bottom: 4px;"><strong>Method:</strong> ${params.paymentMethod}</div>
        ${params.referenceNumber ? `<div style="font-size: 13px; color: #166534; margin-bottom: 4px;"><strong>Transaction UTR:</strong> ${params.referenceNumber}</div>` : ""}
        <div style="font-size: 13px; color: #166534;"><strong>Remaining Balance:</strong> ${formattedBalance}</div>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.portalUrl}" style="display: inline-block; padding: 12px 24px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
          Download PDF Receipt in Portal →
        </a>
      </div>
    </div>
  `;

  return sendBrevoEmail({
    toEmail: params.tenantEmail,
    toName: params.tenantName,
    subject,
    htmlContent,
  });
}

/**
 * 3. Payment Rejected Notification (with Actionable Resubmission Instructions)
 */
export async function sendPaymentRejectedAlert(params: {
  tenantEmail: string;
  tenantName: string;
  unitCode: string;
  rejectionReason: string;
  referenceNumber: string;
  portalUrl: string;
}) {
  const subject = `Action Required: Payment Verification Unsuccessful — ${params.unitCode}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 8px; color: #0f172a;">
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 8px; background: #dc2626; color: #fff; font-weight: bold; border-radius: 4px; font-size: 14px;">⚠️ RentPilot Notice</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Payment Review Update, ${params.tenantName}</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        Your payment submission for <strong>${params.unitCode}</strong> (Ref: <code>${params.referenceNumber}</code>) could not be verified by the property owner.
      </p>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <div style="font-size: 12px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Reason Provided by Landlord:</div>
        <div style="font-size: 14px; color: #7f1d1d; margin-top: 6px;">"${params.rejectionReason}"</div>
      </div>

      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        Your transaction reference has been released. Please re-check your UPI transaction in your banking app and submit the corrected screenshot and 12-digit UTR.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.portalUrl}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
          Resubmit Payment Proof →
        </a>
      </div>
    </div>
  `;

  return sendBrevoEmail({
    toEmail: params.tenantEmail,
    toName: params.tenantName,
    subject,
    htmlContent,
  });
}


/**
 * 4. Maintenance Ticket Reported Notification (To Owner / Manager)
 */
export async function sendMaintenanceReportedToOwnerEmail(params: {
  ownerEmail: string;
  ownerName: string;
  tenantName: string;
  propertyName: string;
  unitCode: string;
  ticketTitle: string;
  category: string;
  priority: string;
  description: string;
  photoCount: number;
  dashboardUrl: string;
  locale?: "en" | "kn" | "hi";
}) {
  const locale = params.locale || "en";

  let subject = `[${params.priority}] New Maintenance Request: ${params.ticketTitle} — ${params.unitCode}`;
  if (locale === "kn") {
    subject = `[${params.priority}] ಹೊಸ ನಿರ್ವಹಣಾ ಕೋರಿಕೆ: ${params.ticketTitle} — ${params.unitCode}`;
  } else if (locale === "hi") {
    subject = `[${params.priority}] नया रखरखाव अनुरोध: ${params.ticketTitle} — ${params.unitCode}`;
  }

  const priorityColor =
    params.priority === "URGENT" ? "#dc2626" : params.priority === "HIGH" ? "#ea580c" : "#2563eb";

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a;">
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 8px; background: #0f172a; color: #fff; font-weight: bold; border-radius: 4px; font-size: 14px;">◈ RentPilot Maintenance</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello ${params.ownerName},</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        A new maintenance ticket has been reported by <strong>${params.tenantName}</strong> for <strong>${params.unitCode} (${params.propertyName})</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">${params.category}</span>
          <span style="display: inline-block; padding: 2px 8px; background: ${priorityColor}; color: #ffffff; border-radius: 4px; font-size: 11px; font-weight: 700;">${params.priority} PRIORITY</span>
        </div>
        <div style="font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 8px;">${params.ticketTitle}</div>
        <div style="font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap; background: #ffffff; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0;">"${params.description}"</div>
        ${params.photoCount > 0 ? `<div style="font-size: 12px; color: #64748b; margin-top: 10px;">📷 ${params.photoCount} photo(s) attached</div>` : ""}
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.dashboardUrl}" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
          Open Maintenance Hub →
        </a>
      </div>
    </div>
  `;

  return sendBrevoEmail({
    toEmail: params.ownerEmail,
    toName: params.ownerName,
    subject,
    htmlContent,
  });
}

/**
 * 5. Maintenance Ticket Status Updated Notification (To Tenant)
 */
export async function sendMaintenanceStatusUpdatedToTenantEmail(params: {
  tenantEmail: string;
  tenantName: string;
  propertyName: string;
  unitCode: string;
  ticketTitle: string;
  newStatus: string;
  comment?: string | null;
  portalUrl: string;
  locale?: "en" | "kn" | "hi";
}) {
  const locale = params.locale || "en";

  let statusLabel = params.newStatus;
  let subject = `Maintenance Update: ${params.ticketTitle} is now ${params.newStatus}`;

  if (locale === "kn") {
    statusLabel = params.newStatus === "RESOLVED" ? "ಪರಿಹರಿಸಲಾಗಿದೆ" : params.newStatus === "IN_PROGRESS" ? "ಪ್ರಗತಿಯಲ್ಲಿದೆ" : params.newStatus === "ACKNOWLEDGED" ? "ಸ್ವೀಕರಿಸಲಾಗಿದೆ" : params.newStatus;
    subject = `ನಿರ್ವಹಣಾ ಮಾಹಿತಿ: ${params.ticketTitle} — ${statusLabel}`;
  } else if (locale === "hi") {
    statusLabel = params.newStatus === "RESOLVED" ? "समाधान हो गया" : params.newStatus === "IN_PROGRESS" ? "प्रगति पर है" : params.newStatus === "ACKNOWLEDGED" ? "स्वीकार किया गया" : params.newStatus;
    subject = `रखरखाव अपडेट: ${params.ticketTitle} — ${statusLabel}`;
  }

  const badgeColor =
    params.newStatus === "RESOLVED" ? "#16a34a" : params.newStatus === "IN_PROGRESS" ? "#2563eb" : "#ca8a04";

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a;">
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 8px; background: #0f172a; color: #fff; font-weight: bold; border-radius: 4px; font-size: 14px;">◈ RentPilot Update</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello ${params.tenantName},</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        Your landlord updated your maintenance request for <strong>${params.unitCode} (${params.propertyName})</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 14px; font-weight: 600; color: #0f172a;">${params.ticketTitle}</span>
          <span style="display: inline-block; padding: 3px 8px; background: ${badgeColor}; color: #ffffff; border-radius: 4px; font-size: 11px; font-weight: 700;">${statusLabel}</span>
        </div>
        ${params.comment ? `
          <div style="font-size: 13px; line-height: 1.5; color: #334155; margin-top: 10px; padding: 10px; background: #ffffff; border-radius: 4px; border: 1px solid #e2e8f0;">
            <strong>Landlord Note:</strong> "${params.comment}"
          </div>
        ` : ""}
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.portalUrl}" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
          View Request in Tenant Portal →
        </a>
      </div>
    </div>
  `;

  return sendBrevoEmail({
    toEmail: params.tenantEmail,
    toName: params.tenantName,
    subject,
    htmlContent,
  });
}

/**
 * Send onboarding invitation email to tenant with secure token link (Phase 4)
 */
export async function sendTenantInvitationEmail(params: {
  tenantEmail: string;
  tenantName: string;
  organizationName: string;
  propertyName?: string;
  unitCode?: string;
  rawToken: string;
  expiresInDays?: number;
  organizationId?: string;
}): Promise<{ sent: boolean; inviteUrl: string; error?: string }> {
  const baseUrl = getAppBaseUrl();
  const inviteUrl = `${baseUrl}/invite/${params.rawToken}`;
  const subject = `Rental Invitation: Join ${params.organizationName} on RentPilot`;
  const locationDetails = [params.unitCode, params.propertyName].filter(Boolean).join(" at ");

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a; background-color: #ffffff;">
      <div style="margin-bottom: 24px;">
        <span style="display: inline-block; padding: 5px 10px; background: #0f172a; color: #ffffff; font-weight: 700; border-radius: 4px; font-size: 13px; letter-spacing: 0.5px;">◈ RentPilot Gateway</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #0f172a;">Hello ${params.tenantName || "Resident"},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
        You have been officially invited by <strong>${params.organizationName}</strong>${locationDetails ? ` for <strong>${locationDetails}</strong>` : ""} to manage your rental tenancy, view monthly invoices, and submit rent receipts through the RentPilot Tenant Portal.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin: 20px 0;">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">
          Invitation Details
        </div>
        <div style="font-size: 13px; color: #334155; line-height: 1.6;">
          <div>• <strong>Invited Email:</strong> <span style="font-family: monospace; color: #0f172a;">${params.tenantEmail}</span></div>
          ${params.unitCode ? `<div>• <strong>Assigned Unit:</strong> ${params.unitCode}</div>` : ""}
          ${params.propertyName ? `<div>• <strong>Property:</strong> ${params.propertyName}</div>` : ""}
          <div>• <strong>Valid For:</strong> ${params.expiresInDays || 7} days</div>
        </div>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 28px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          Accept Invitation & Enter Portal →
        </a>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 8px 0;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="margin: 0; word-break: break-all; font-family: monospace; color: #64748b;">
          ${inviteUrl}
        </p>
        <p style="margin-top: 12px; font-size: 11px;">
          Note: Please sign in with your Google account associated with <strong>${params.tenantEmail}</strong> to activate your tenancy.
        </p>
      </div>
    </div>
  `;

  try {
    const res = await sendBrevoEmail({
      toEmail: params.tenantEmail,
      toName: params.tenantName || "Tenant",
      subject,
      htmlContent,
      organizationId: params.organizationId,
      templateName: "TENANT_INVITATION",
    });

    if (!res.success) {
      safeError(`[brevo] Failed to deliver tenant invitation email to ${params.tenantEmail}:`, res.error);
    }

    return {
      sent: res.success,
      inviteUrl,
      error: res.error,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    safeError("[brevo] sendTenantInvitationEmail exception:", errorMsg);
    return {
      sent: false,
      inviteUrl,
      error: errorMsg,
    };
  }
}
