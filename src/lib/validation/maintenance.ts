import { z } from "zod";

export const MAINTENANCE_CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "APPLIANCE",
  "CARPENTRY",
  "STRUCTURAL",
  "PEST_CONTROL",
  "OTHER",
] as const;

export const MAINTENANCE_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

export const MAINTENANCE_STATUSES = [
  "REPORTED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
] as const;

export const MAINTENANCE_PAID_BY = [
  "OWNER",
  "TENANT",
  "SHARED",
] as const;

export const MaintenanceCategoryEnum = z.enum(MAINTENANCE_CATEGORIES);
export const MaintenancePriorityEnum = z.enum(MAINTENANCE_PRIORITIES);
export const MaintenanceStatusEnum = z.enum(MAINTENANCE_STATUSES);
export const MaintenancePaidByEnum = z.enum(MAINTENANCE_PAID_BY);

export const CreateMaintenanceRequestSchema = z.object({
  tenancyId: z.string().uuid("Invalid tenancy ID").optional(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120, "Title cannot exceed 120 characters"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000, "Description cannot exceed 2000 characters"),
  category: MaintenanceCategoryEnum,
  priority: MaintenancePriorityEnum.default("MEDIUM"),
  photoPaths: z.array(z.string().min(3)).max(4, "Maximum 4 photos allowed per ticket").default([]),
}).strict();

export const UpdateMaintenanceRequestSchema = z.object({
  status: MaintenanceStatusEnum.optional(),
  comment: z.string().trim().min(1).max(1000).optional(),
  isInternalNote: z.boolean().default(false),
  repairCostRupees: z.coerce.number().min(0, "Repair cost cannot be negative").optional(),
  paidBy: MaintenancePaidByEnum.optional(),
  resolutionNotes: z.string().trim().max(1000).optional().nullable(),
}).strict();

export const MaintenanceUploadUrlSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"], {
    message: "Only JPEG, PNG, and WebP images are permitted for maintenance photos",
  }),
  fileSizeBytes: z.coerce.number().int().positive().max(5242880, "Image size exceeds 5 MB limit"),
}).strict();

export type CreateMaintenanceRequestInput = z.infer<typeof CreateMaintenanceRequestSchema>;
export type UpdateMaintenanceRequestInput = z.infer<typeof UpdateMaintenanceRequestSchema>;
export type MaintenanceUploadUrlInput = z.infer<typeof MaintenanceUploadUrlSchema>;
