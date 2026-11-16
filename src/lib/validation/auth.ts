import { z } from "zod";

export const ProfileSyncSchema = z.object({
  idToken: z.string().min(10, "ID token is required"),
  preferredLocale: z.enum(["en", "kn", "hi"]).optional(),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name must be at least 2 characters").max(100),
  billingDayOfMonth: z.number().int().min(1).max(28).default(10),
  currency: z.string().default("INR"),
  timezone: z.string().default("Asia/Kolkata"),
});

export const CreateTenantInvitationSchema = z.object({
  invitedEmail: z.string().trim().toLowerCase().email("Invalid email address"),
  unitId: z.string().uuid("Invalid unit UUID").optional().nullable(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const AcceptInvitationSchema = z.object({
  token: z.string().min(16, "Invalid invitation token"),
});

export type ProfileSyncInput = z.infer<typeof ProfileSyncSchema>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type CreateTenantInvitationInput = z.infer<typeof CreateTenantInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
