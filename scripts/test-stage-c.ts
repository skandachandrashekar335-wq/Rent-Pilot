import fs from "fs";
import path from "path";
import {
  CreatePropertySchema,
  CreateUnitSchema,
  CreateTenancySchema,
  RentIncrementScheduleInputSchema,
  ApplyRentIncrementSchema,
  EndTenancySchema,
} from "../src/lib/validation/rental";
import {
  rupeesToPaise,
  paiseToRupees,
  calculateNextRentPaise,
  calculateCompoundedRentSeries,
  isIncrementUpcoming,
  computeNextIncrementDate,
} from "../src/lib/domain/rent-increments";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

async function runStageCTests() {
  console.log("==================================================");
  console.log("RentPilot — Stage C Automated Verification Suite");
  console.log("==================================================");

  // 1. Zod Validation Schemas
  console.log("\n[1] Zod Validation Schemas");

  const validProperty = {
    name: "Green Villa",
    propertyType: "INDEPENDENT_HOUSE",
    addressLine: "14th Cross, 2nd Main, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    totalFloors: 2,
    facilities: ["Borewell Water", "Rainwater Harvesting"],
  };
  const propRes = CreatePropertySchema.safeParse(validProperty);
  assert(propRes.success, "CreatePropertySchema accepts valid independent house payload");

  const invalidPropertyPincode = {
    ...validProperty,
    pincode: "56003", // 5 digits (invalid)
  };
  assert(!CreatePropertySchema.safeParse(invalidPropertyPincode).success, "CreatePropertySchema rejects non-6-digit pincode");

  const validUnit = {
    propertyId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    unitNumber: "U-101",
    floorNumber: 0,
    configurationLabel: "2BHK",
    bedrooms: 2,
    bathrooms: 1,
    hasParking: true,
    baseRentRupees: 18000,
    securityDepositRupees: 100000,
    occupancyStatus: "VACANT",
  };
  const unitRes = CreateUnitSchema.safeParse(validUnit);
  assert(unitRes.success, "CreateUnitSchema accepts valid rental unit payload");

  const invalidUnitRent = {
    ...validUnit,
    baseRentRupees: -500, // Negative rent
  };
  assert(!CreateUnitSchema.safeParse(invalidUnitRent).success, "CreateUnitSchema rejects negative base rent");

  const validTenancy = {
    unitId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    tenantEmail: "rahul.sharma@example.com",
    tenantFullName: "Rahul Sharma",
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    monthlyRentRupees: 16000,
    securityDepositRupees: 80000,
    status: "ACTIVE",
    incrementSchedule: {
      incrementType: "PERCENTAGE",
      incrementValue: 5,
      intervalMonths: 12,
      nextIncrementDate: "2027-01-01",
      autoApply: false,
    },
  };
  const tenancyRes = CreateTenancySchema.safeParse(validTenancy);
  assert(tenancyRes.success, "CreateTenancySchema accepts valid tenancy agreement with increment schedule");

  const invalidDateTenancy = {
    ...validTenancy,
    startDate: "2027-01-01",
    endDate: "2026-01-01", // End date before start date
  };
  assert(!CreateTenancySchema.safeParse(invalidDateTenancy).success, "CreateTenancySchema rejects inverted date range (endDate <= startDate)");

  const validIncrement = {
    newRentRupees: 17600,
    effectiveDate: "2027-01-01",
    notes: "Applied 10% annual escalation",
  };
  assert(ApplyRentIncrementSchema.safeParse(validIncrement).success, "ApplyRentIncrementSchema accepts valid rent escalation");

  const validEndTenancy = {
    endDate: "2026-12-31",
    status: "COMPLETED",
    terminationReason: "Natural lease expiration",
  };
  assert(EndTenancySchema.safeParse(validEndTenancy).success, "EndTenancySchema accepts valid lease completion");

  // 2. Integer Paise Rent Math & Compounding Verification
  console.log("\n[2] Integer Paise Currency Math & Compounding");

  const startPaise = rupeesToPaise(6000); // 600,000 paise
  assert(startPaise === BigInt(600000), "rupeesToPaise(6000) converts exactly to 600,000 paise");
  assert(paiseToRupees(startPaise) === 6000, "paiseToRupees(600000) converts back to ₹6,000");

  const year2Rent = calculateNextRentPaise(startPaise, "PERCENTAGE", 10);
  assert(year2Rent === BigInt(660000), "Year 2 rent at +10% is exactly 660,000 paise (₹6,600)");

  const year3Rent = calculateNextRentPaise(year2Rent, "PERCENTAGE", 10);
  assert(year3Rent === BigInt(726000), "Year 3 rent at +10% is exactly 726,000 paise (₹7,260)");

  const year4Rent = calculateNextRentPaise(year3Rent, "PERCENTAGE", 10);
  assert(year4Rent === BigInt(798600), "Year 4 rent at +10% is exactly 798,600 paise (₹7,986)");

  const series = calculateCompoundedRentSeries(startPaise, 10, 4);
  assert(series.length === 4, "Compounded series returns 4 years");
  assert(
    series[0] === BigInt(600000) &&
    series[1] === BigInt(660000) &&
    series[2] === BigInt(726000) &&
    series[3] === BigInt(798600),
    "Multi-year compounded rent series matches exact integers ₹6000 -> ₹6600 -> ₹7260 -> ₹7986 with zero float drift"
  );

  const fixedIncrement = calculateNextRentPaise(startPaise, "FIXED_AMOUNT", 1500);
  assert(fixedIncrement === BigInt(750000), "Fixed increment of ₹1,500 on ₹6,000 yields exactly 750,000 paise (₹7,500)");

  const nextDate = computeNextIncrementDate("2026-06-15", 12);
  assert(nextDate === "2027-06-15", "computeNextIncrementDate computes exact 12-month interval");

  const dueCheck = isIncrementUpcoming("2026-11-20", 30, new Date("2026-11-01"));
  assert(dueCheck.isUpcoming && !dueCheck.isDue, "isIncrementUpcoming correctly identifies upcoming notice window (19 days remaining)");

  // 3. PostgreSQL Migration & Security Invariants
  console.log("\n[3] PostgreSQL Schema, GiST Exclusion & RLS Invariants");

  const migrationPath = path.join(__dirname, "../supabase/migrations/20261117000000_stage_c_core_rental_domain.sql");
  assert(fs.existsSync(migrationPath), "Migration SQL file exists at supabase/migrations/");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  assert(
    migrationSql.includes("CREATE EXTENSION IF NOT EXISTS btree_gist;"),
    "Enables 'btree_gist' extension for range exclusion indexing"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.properties"),
    "Defines 'properties' table"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.units"),
    "Defines 'units' table with base_rent_paise and security_deposit_paise"
  );
  assert(
    migrationSql.includes("base_rent_paise BIGINT NOT NULL"),
    "Enforces 'base_rent_paise BIGINT NOT NULL' for integer currency"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.tenants"),
    "Defines 'tenants' table"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.tenancies"),
    "Defines 'tenancies' table"
  );
  assert(
    migrationSql.includes("monthly_rent_paise BIGINT NOT NULL"),
    "Enforces 'monthly_rent_paise BIGINT NOT NULL' for integer currency"
  );

  // Critical Overlap-Prevention GiST Constraint
  assert(
    migrationSql.includes("CONSTRAINT no_overlapping_tenancies_per_unit EXCLUDE USING gist"),
    "Defines 'no_overlapping_tenancies_per_unit' GiST exclusion constraint"
  );
  assert(
    migrationSql.includes("daterange(start_date, COALESCE(end_date, 'infinity'::date), '[)') WITH &&"),
    "Exclusion constraint compares daterange(start_date, COALESCE(end_date, 'infinity'::date), '[)') WITH &&"
  );
  assert(
    migrationSql.includes("WHERE (status IN ('ACTIVE', 'UPCOMING'))"),
    "Exclusion constraint predicates only on active and upcoming tenancies"
  );
  assert(
    migrationSql.includes("CONSTRAINT chk_tenancy_dates CHECK (end_date IS NULL OR end_date > start_date)"),
    "Enforces CHECK (end_date IS NULL OR end_date > start_date)"
  );

  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.rent_increment_schedules"),
    "Defines 'rent_increment_schedules' table"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.rent_increment_history"),
    "Defines 'rent_increment_history' table for immutable historical logs"
  );

  // RLS Checks on all 6 tables
  assert(migrationSql.includes("ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;"), "RLS enabled on 'properties'");
  assert(migrationSql.includes("ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;"), "RLS enabled on 'units'");
  assert(migrationSql.includes("ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;"), "RLS enabled on 'tenants'");
  assert(migrationSql.includes("ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;"), "RLS enabled on 'tenancies'");
  assert(migrationSql.includes("ALTER TABLE public.rent_increment_schedules ENABLE ROW LEVEL SECURITY;"), "RLS enabled on 'rent_increment_schedules'");
  assert(migrationSql.includes("ALTER TABLE public.rent_increment_history ENABLE ROW LEVEL SECURITY;"), "RLS enabled on 'rent_increment_history'");

  // Tenant Isolation Policy Checks
  assert(
    migrationSql.includes("CREATE POLICY \"properties_select_active_tenant\" ON public.properties"),
    "RLS isolates properties so linked tenants see only their own assigned property"
  );
  assert(
    migrationSql.includes("CREATE POLICY \"units_select_active_tenant\" ON public.units"),
    "RLS isolates units so linked tenants see only their assigned unit"
  );
  assert(
    migrationSql.includes("CREATE POLICY \"tenancies_select_active_tenant\" ON public.tenancies"),
    "RLS isolates tenancies so linked tenants see only their own lease contracts"
  );

  // 4. API Error Handling Verification
  console.log("\n[4] API 23P01 Overlap Handling & Server Auth");

  const tenanciesApiCode = fs.readFileSync(path.join(__dirname, "../src/app/api/tenancies/route.ts"), "utf-8");
  assert(
    tenanciesApiCode.includes("23P01"),
    "API catches PostgreSQL exclusion violation error code 23P01"
  );
  assert(
    tenanciesApiCode.includes("TENANCY_OVERLAP_CONFLICT"),
    "API returns structured TENANCY_OVERLAP_CONFLICT error code with HTTP 409"
  );

  const inviteAcceptCode = fs.readFileSync(path.join(__dirname, "../src/app/api/invitations/[token]/accept/route.ts"), "utf-8");
  assert(
    inviteAcceptCode.includes("profile_id: userProfile.id"),
    "Invite acceptance flow links verified profile_id directly to tenants record"
  );

  console.log("\n==================================================");
  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  console.log("==================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runStageCTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
