import { z } from "zod";
import { sanitizeText } from "./sanitize";

export const ProfileSyncSchema = z.object({
  idToken: z.string().min(10, "ID token is required"),
  preferredLocale: z.enum(["en", "kn", "hi"]).optional(),
}).strict();

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().transform(sanitizeText).refine((s) => s.length >= 2, "Organization name must be at least 2 characters"),
  billingDayOfMonth: z.number().int().min(1).max(28).default(10),
  currency: z.string().default("INR"),
  timezone: z.string().default("Asia/Kolkata"),
}).strict();

export const CreateTenantInvitationSchema = z.object({
  invitedEmail: z.string().trim().toLowerCase().email("Invalid email address").optional(),
  email: z.string().trim().toLowerCase().email("Invalid email address").optional(),
  fullName: z.string().trim().transform(sanitizeText).optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  unitId: z.string().uuid("Invalid unit UUID").optional().nullable(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
}).transform((data) => ({
  ...data,
  invitedEmail: (data.invitedEmail || data.email || "").toLowerCase(),
})).refine((d) => Boolean(d.invitedEmail), {
  message: "Invalid email address",
  path: ["invitedEmail"],
});

export const AcceptInvitationSchema = z.object({
  token: z.string().min(16, "Invalid invitation token"),
}).strict();

export type ProfileSyncInput = z.infer<typeof ProfileSyncSchema>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type CreateTenantInvitationInput = z.infer<typeof CreateTenantInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
