import { z } from "zod";

export const PropertyTypeEnum = z.enum([
  "INDEPENDENT_HOUSE",
  "APARTMENT_BUILDING",
  "COMMERCIAL",
  "OTHER",
]);

export const OccupancyStatusEnum = z.enum(["VACANT", "OCCUPIED", "MAINTENANCE"]);

export const TenancyStatusEnum = z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "TERMINATED"]);

export const IncrementTypeEnum = z.enum(["PERCENTAGE", "FIXED_AMOUNT"]);

export const CreatePropertySchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  name: z.string().trim().min(2, "Property name must be at least 2 characters").max(100),
  propertyType: PropertyTypeEnum.default("INDEPENDENT_HOUSE"),
  addressLine: z.string().trim().min(3, "Address is required"),
  city: z.string().trim().default("Bengaluru"),
  state: z.string().trim().default("Karnataka"),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
  totalFloors: z.coerce.number().int().min(1).max(50).default(1),
  facilities: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

export const UpdatePropertySchema = CreatePropertySchema.partial();

export const CreateUnitSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  propertyId: z.string().uuid("Invalid property ID"),
  unitNumber: z.string().trim().min(1, "Unit number is required").max(20),
  floorNumber: z.coerce.number().int().min(0).max(50).optional().nullable(),
  configurationLabel: z.string().trim().min(1).max(30).default("2BHK"),
  bedrooms: z.coerce.number().int().min(0).max(20).default(2),
  bathrooms: z.coerce.number().int().min(1).max(20).default(1),
  hasParking: z.boolean().default(false),
  facilities: z.array(z.string()).default([]),
  baseRentRupees: z.coerce.number().min(0, "Rent cannot be negative"),
  securityDepositRupees: z.coerce.number().min(0, "Deposit cannot be negative").default(0),
  occupancyStatus: OccupancyStatusEnum.default("VACANT"),
});

export const UpdateUnitSchema = CreateUnitSchema.partial();

export const CreateTenantSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  phone: z.string().trim().optional().nullable(),
  emergencyContact: z.string().trim().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const RentIncrementScheduleInputSchema = z.object({
  incrementType: IncrementTypeEnum.default("PERCENTAGE"),
  incrementValue: z.coerce.number().positive("Increment value must be positive"),
  intervalMonths: z.coerce.number().int().min(1).max(60).default(12),
  nextIncrementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  autoApply: z.boolean().default(false),
});

export const CreateTenancySchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  unitId: z.string().uuid("Invalid unit ID"),
  tenantId: z.string().uuid("Invalid tenant ID").optional(),
  // Tenant details (for inline auto-creation or lookup)
  tenantEmail: z.string().trim().toLowerCase().email("Invalid tenant email"),
  tenantFullName: z.string().trim().min(2, "Tenant name is required"),
  tenantPhone: z.string().trim().optional().nullable(),
  // Tenancy financial & lease terms
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD").optional().nullable(),
  monthlyRentRupees: z.coerce.number().positive("Monthly rent must be positive"),
  securityDepositRupees: z.coerce.number().min(0).default(0),
  status: TenancyStatusEnum.default("ACTIVE"),
  // Optional increment schedule configuration
  incrementSchedule: RentIncrementScheduleInputSchema.optional().nullable(),
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

export const ApplyRentIncrementSchema = z.object({
  newRentRupees: z.coerce.number().positive("New rent must be positive"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  notes: z.string().optional().nullable(),
});

export const EndTenancySchema = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  status: z.enum(["COMPLETED", "TERMINATED"]).default("COMPLETED"),
  terminationReason: z.string().optional().nullable(),
});

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type CreateTenancyInput = z.infer<typeof CreateTenancySchema>;
export type ApplyRentIncrementInput = z.infer<typeof ApplyRentIncrementSchema>;
export type EndTenancyInput = z.infer<typeof EndTenancySchema>;
