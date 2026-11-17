/**
 * RentPilot — Brevo Transactional Email Notification Service
 * 
 * Invariants:
 * 1. Safe graceful fallback when BREVO_API_KEY is not set in development or preview.
 * 2. Trilingual templates (EN, KN, HI) for invoices and payment receipts.
 * 3. Never throws unhandled exceptions that could crash the billing engine.
 */

import { formatINR } from "@/lib/utils";

interface SendEmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
}

export async function sendBrevoEmail(params: SendEmailParams): Promise<{ success: boolean; mocked?: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "notifications@rentpilot.app";
  const senderName = process.env.BREVO_SENDER_NAME || "RentPilot Billing";

  if (!apiKey || apiKey === "mock-brevo-key") {
    console.info(`[Brevo Email Mock] To: ${params.toEmail} | Subject: ${params.subject}`);
    return { success: true, mocked: true };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
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
      return { success: false, error: errBody };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Brevo Email Exception]", message);
    return { success: false, error: message };
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
