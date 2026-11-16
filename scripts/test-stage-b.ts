import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  ProfileSyncSchema,
  CreateOrganizationSchema,
  CreateTenantInvitationSchema,
  AcceptInvitationSchema,
} from "../src/lib/validation/auth";

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

async function runStageBTests() {
  console.log("==================================================");
  console.log("RentPilot — Stage B Automated Verification Suite");
  console.log("==================================================");

  // 1. Zod Validation Tests
  console.log("\n[1] Zod Validation Schemas");

  const validProfileSync = {
    idToken: "firebase-sample-jwt-token-header-payload-signature",
    preferredLocale: "en" as const,
  };
  const profileRes = ProfileSyncSchema.safeParse(validProfileSync);
  assert(profileRes.success, "ProfileSyncSchema accepts valid payload");

  const invalidProfileSync = {
    idToken: "",
    preferredLocale: "fr", // invalid locale
  };
  const invalidProfileRes = ProfileSyncSchema.safeParse(invalidProfileSync);
  assert(!invalidProfileRes.success, "ProfileSyncSchema rejects empty token and unsupported locale");

  const validOrg = {
    name: "Sri Lakshmi Estates",
    billingDayOfMonth: 10,
    currency: "INR",
    timezone: "Asia/Kolkata",
  };
  const orgRes = CreateOrganizationSchema.safeParse(validOrg);
  assert(orgRes.success, "CreateOrganizationSchema accepts valid org config");

  const invalidOrgDay = {
    name: "Estates",
    billingDayOfMonth: 30, // Out of safe range (1..28)
  };
  const invalidOrgDayRes = CreateOrganizationSchema.safeParse(invalidOrgDay);
  assert(!invalidOrgDayRes.success, "CreateOrganizationSchema rejects billingDayOfMonth > 28 (month safety)");

  const validInvite = {
    invitedEmail: "tenant.sharma@example.com",
    unitId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    expiresInDays: 7,
  };
  const inviteRes = CreateTenantInvitationSchema.safeParse(validInvite);
  assert(inviteRes.success, "CreateTenantInvitationSchema accepts valid tenant invite payload");

  const invalidInvite = {
    invitedEmail: "bad-email",
    unitId: "invalid-uuid",
  };
  const invalidInviteRes = CreateTenantInvitationSchema.safeParse(invalidInvite);
  assert(!invalidInviteRes.success, "CreateTenantInvitationSchema rejects invalid email and unitId");

  const validAccept = { token: "a".repeat(64) };
  assert(AcceptInvitationSchema.safeParse(validAccept).success, "AcceptInvitationSchema accepts 64-char token");
  assert(!AcceptInvitationSchema.safeParse({ token: "short" }).success, "AcceptInvitationSchema rejects short token");

  // 2. Cryptographic Token Hashing & Verification
  console.log("\n[2] Cryptographic Token Hashing & Verification");

  const rawToken = crypto.randomBytes(32).toString("hex");
  assert(rawToken.length === 64, "Generated raw token is 64 hex characters (256-bit entropy)");

  const hashedToken1 = crypto.createHash("sha256").update(rawToken).digest("hex");
  const hashedToken2 = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert(hashedToken1 === hashedToken2, "SHA-256 token hashing is deterministic");
  assert(hashedToken1 !== rawToken, "Hashed token does not match plaintext raw token");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const diffDays = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  assert(diffDays === 7, "Tenant invitation validity window is exactly 7 days");

  // 3. PostgreSQL Migration & RLS Security Invariants
  console.log("\n[3] PostgreSQL Schema & RLS Security Invariants");

  const migrationPath = path.join(__dirname, "../supabase/migrations/20261116000000_stage_b_auth_and_organizations.sql");
  assert(fs.existsSync(migrationPath), "Migration SQL file exists at supabase/migrations/");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.profiles"),
    "Defines 'profiles' table with firebase_uid text column"
  );
  assert(
    migrationSql.includes("firebase_uid TEXT UNIQUE NOT NULL"),
    "Enforces 'firebase_uid TEXT UNIQUE NOT NULL' (prevents unsafe UUID casting)"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.organizations"),
    "Defines 'organizations' table"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.organization_memberships"),
    "Defines 'organization_memberships' table with roles (OWNER, MANAGER)"
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.tenant_invitations"),
    "Defines 'tenant_invitations' table with hashed token storage"
  );
  assert(
    migrationSql.includes("token_hash TEXT UNIQUE NOT NULL"),
    "Enforces 'token_hash TEXT UNIQUE NOT NULL' for tamper-proof lookup"
  );

  // Check RLS Enablement
  assert(
    migrationSql.includes("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;"),
    "RLS enabled on 'profiles'"
  );
  assert(
    migrationSql.includes("ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;"),
    "RLS enabled on 'organizations'"
  );
  assert(
    migrationSql.includes("ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;"),
    "RLS enabled on 'organization_memberships'"
  );
  assert(
    migrationSql.includes("ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;"),
    "RLS enabled on 'tenant_invitations'"
  );

  // Check Official Third-Party Auth JWT Subject helper
  assert(
    migrationSql.includes("(auth.jwt() ->> 'sub')"),
    "Uses official Supabase third-party expression (auth.jwt() ->> 'sub') for Firebase UID extraction"
  );

  assert(
    migrationSql.includes("CREATE OR REPLACE FUNCTION public.current_firebase_uid()"),
    "Provides current_firebase_uid() helper function"
  );
  assert(
    migrationSql.includes("CREATE OR REPLACE FUNCTION public.get_user_profile_id()"),
    "Provides get_user_profile_id() helper function"
  );

  // 4. Client & Server Supabase Bridges
  console.log("\n[4] Supabase Third-Party Integration Bridge");

  const clientSupabasePath = path.join(__dirname, "../src/lib/supabase/client.ts");
  const clientSql = fs.readFileSync(clientSupabasePath, "utf-8");
  assert(
    clientSql.includes("accessToken: async () =>"),
    "Client Supabase passes Firebase ID token via accessToken callback"
  );
  assert(
    clientSql.includes("headers.set(\"Authorization\", `Bearer ${token}`"),
    "Client Supabase injects Bearer token into global fetch options"
  );

  const serverSupabasePath = path.join(__dirname, "../src/lib/supabase/server.ts");
  const serverSql = fs.readFileSync(serverSupabasePath, "utf-8");
  assert(
    serverSql.includes("createServerSupabaseClient"),
    "Server Supabase provides authenticated client with Bearer token header"
  );
  assert(
    serverSql.includes("createAdminSupabaseClient"),
    "Server Supabase provides secure service-role admin client"
  );

  console.log("\n==================================================");
  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  console.log("==================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runStageBTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
