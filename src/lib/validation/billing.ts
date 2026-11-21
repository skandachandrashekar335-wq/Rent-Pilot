import { z } from "zod";
import { normalizePaymentReference } from "@/lib/domain/billing";
import { sanitizeText } from "./sanitize";

export const VariableChargeItemSchema = z.object({
  tenancyId: z.string().uuid("Invalid tenancy ID"),
  electricityRupees: z.coerce.number().min(0, "Electricity charge cannot be negative").default(0),
  waterRupees: z.coerce.number().min(0, "Water charge cannot be negative").default(0),
  maintenanceRupees: z.coerce.number().min(0, "Maintenance charge cannot be negative").default(0),
  otherChargesRupees: z.coerce.number().min(0, "Other charges cannot be negative").default(0),
  creditsRupees: z.coerce.number().min(0, "Credits cannot be negative").default(0),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD"),
  notes: z.string().optional().nullable(),
}).strict();

export const BillingBatchSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  billingYear: z.coerce.number().int().min(2020).max(2050),
  billingMonth: z.coerce.number().int().min(1).max(12),
  items: z.array(VariableChargeItemSchema).min(1, "At least one unit required for billing batch"),
  finalizeAndIssue: z.boolean().default(false),
}).strict();

export const SubmitPaymentProofSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  invoiceId: z.string().uuid("Invalid invoice ID"),
  tenancyId: z.string().uuid("Invalid tenancy ID"),
  amountRupees: z.coerce.number().positive("Amount must be greater than zero"),
  rawReference: z.string().trim().min(8, "Transaction reference must be at least 8 characters").max(40),
  storagePath: z.string().min(3, "Receipt screenshot is required"),
}).strict().transform((data) => {
  const normalized = normalizePaymentReference(data.rawReference);
  return {
    ...data,
    normalizedReference: normalized,
  };
}).refine((data) => data.normalizedReference.length >= 8 && data.normalizedReference.length <= 30, {
  message: "Normalized alphanumeric transaction reference must be between 8 and 30 characters",
  path: ["rawReference"],
});

export const ReviewPaymentSubmissionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().trim().transform(sanitizeText).optional().nullable(),
}).strict().refine((data) => {
  if (data.action === "REJECT" && (!data.rejectionReason || data.rejectionReason.length < 3)) {
    return false;
  }
  return true;
}, {
  message: "A clear rejection reason is mandatory when rejecting a payment submission",
  path: ["rejectionReason"],
});

export const RecordOfflinePaymentSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  invoiceId: z.string().uuid("Invalid invoice ID"),
  tenancyId: z.string().uuid("Invalid tenancy ID").optional(),
  amountRupees: z.coerce.number().positive("Payment amount must be positive"),
  paymentMethod: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  referenceNumber: z.string().trim().transform(sanitizeText).optional().nullable(),
  notes: z.string().trim().transform(sanitizeText).optional().nullable(),
}).strict();

export const AdjustInvoiceSchema = z.object({
  adjustmentType: z.enum(["CREDIT", "CHARGE"]),
  amountRupees: z.coerce.number().positive("Adjustment amount must be positive"),
  reason: z.string().trim().transform(sanitizeText).refine((s) => s.length >= 3, "Reason for adjustment is mandatory"),
}).strict();

export type VariableChargeItemInput = z.infer<typeof VariableChargeItemSchema>;
export type BillingBatchInput = z.infer<typeof BillingBatchSchema>;
export type SubmitPaymentProofInput = z.infer<typeof SubmitPaymentProofSchema>;
export type ReviewPaymentSubmissionInput = z.infer<typeof ReviewPaymentSubmissionSchema>;
export type RecordOfflinePaymentInput = z.infer<typeof RecordOfflinePaymentSchema>;
export type AdjustInvoiceInput = z.infer<typeof AdjustInvoiceSchema>;
