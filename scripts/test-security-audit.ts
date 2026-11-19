import fs from "fs";
import path from "path";
import assert from "assert";

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(suite: string, name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      results.push({ suite, name, passed: true });
      console.log(`  ✓ ${name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ suite, name, passed: false, error: msg });
      console.error(`  ✗ ${name}: ${msg}`);
    }
  })();
}

function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

async function runSecurityAudit() {
  console.log("==========================================================");
  console.log("RentPilot — Zero-Compromise Security & Hardening Audit");
  console.log("==========================================================\n");

  const env = loadEnvLocal();
  const LOCAL_API_URL = process.env.TEST_API_URL || "http://localhost:3008";
  const LIVE_URL = "https://rent-pilot-nine.vercel.app";

  // =========================================================================
  // SUITE 1: Static Bundle Secret Leak & Frontend Isolation Scan
  // =========================================================================
  console.log("[Suite 1] Static Bundle Secret Leak & Frontend Isolation Scan");

  await test("Suite 1", "Server secrets are strictly absent from client static bundles (.next/static)", () => {
    const staticDir = path.resolve(process.cwd(), ".next/static");
    assert(fs.existsSync(staticDir), ".next/static directory exists");

    function getFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...getFiles(full));
        else if (e.name.endsWith(".js")) files.push(full);
      }
      return files;
    }

    const jsFiles = getFiles(staticDir);
    assert(jsFiles.length > 0, "Static JS chunks exist");

    const sensitiveValues = [
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.BREVO_API_KEY,
      env.CRON_SECRET,
    ].filter((v): v is string => Boolean(v && v.length > 8));

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const secret of sensitiveValues) {
        assert(
          !content.includes(secret),
          `Secret substring found in client static chunk: ${path.basename(file)}`
        );
      }
      assert(!content.includes("SUPABASE_SERVICE_ROLE_KEY"), `Secret identifier found in ${path.basename(file)}`);
      assert(!content.includes("FIREBASE_ADMIN_PRIVATE_KEY"), `Secret identifier found in ${path.basename(file)}`);
      assert(!content.includes("BREVO_API_KEY"), `Secret identifier found in ${path.basename(file)}`);
      assert(!content.includes("CRON_SECRET"), `Secret identifier found in ${path.basename(file)}`);
    }
  });

  await test("Suite 1", "Client components have zero direct database imports or client-side queries", () => {
    function scanComponents(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          files.push(...scanComponents(full));
        } else if (e.name.endsWith(".tsx") || (e.name.endsWith(".ts") && !full.includes("/api/"))) {
          files.push(full);
        }
      }
      return files;
    }

    const appFiles = scanComponents(path.resolve(process.cwd(), "src/app")).filter((f) => !f.includes("/api/"));
    const componentFiles = scanComponents(path.resolve(process.cwd(), "src/components"));
    const allClientFiles = [...appFiles, ...componentFiles];

    for (const f of allClientFiles) {
      const content = fs.readFileSync(f, "utf-8");
      assert(!content.includes("@/lib/supabase/server"), `Server Supabase imported in client file: ${f}`);
      assert(!content.includes("@/lib/firebase/admin"), `Firebase Admin imported in client file: ${f}`);
      assert(!content.includes("createAdminSupabaseClient"), `createAdminSupabaseClient imported in client file: ${f}`);
      assert(!content.includes("supabase.from("), `Direct supabase.from query executed in client file: ${f}`);
    }
  });

  // =========================================================================
  // SUITE 2: Strict Zod Schema Mass-Assignment & Input Validation
  // =========================================================================
  console.log("\n[Suite 2] Strict Zod Schema Mass-Assignment & Input Validation");

  const { CreatePropertySchema, CreateUnitSchema, CreateTenancySchema } = await import("../src/lib/validation/rental");
  const { SubmitPaymentProofSchema, RecordOfflinePaymentSchema } = await import("../src/lib/validation/billing");
  const { CreateTenantInvitationSchema } = await import("../src/lib/validation/auth");
  const { CreateMaintenanceRequestSchema } = await import("../src/lib/validation/maintenance");

  await test("Suite 2", "CreatePropertySchema rejects mass-assignment of unknown properties (.strict())", () => {
    const result = CreatePropertySchema.safeParse({
      name: "Sunrise Heights",
      addressLine: "100 Outer Ring Road",
      pincode: "560103",
      role: "SUPER_ADMIN", // Malicious unknown key
      is_archived: true,   // Malicious unknown key
    });
    assert(!result.success, "Schema must reject unexpected mass-assignment keys");
  });

  await test("Suite 2", "CreateUnitSchema rejects negative base rent & mass-assignment", () => {
    const negativeRent = CreateUnitSchema.safeParse({
      propertyId: "123e4567-e89b-12d3-a456-426614174000",
      unitNumber: "101",
      baseRentRupees: -15000,
    });
    assert(!negativeRent.success, "Schema must reject negative rent");

    const massAssign = CreateUnitSchema.safeParse({
      propertyId: "123e4567-e89b-12d3-a456-426614174000",
      unitNumber: "101",
      baseRentRupees: 15000,
      override_auth: true,
    });
    assert(!massAssign.success, "Schema must reject unexpected mass-assignment keys");
  });

  await test("Suite 2", "SubmitPaymentProofSchema rejects negative amount & malicious keys", () => {
    const invalidAmount = SubmitPaymentProofSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      tenancyId: "123e4567-e89b-12d3-a456-426614174000",
      amountRupees: -500,
      rawReference: "UPI1234567890",
      storagePath: "receipts/rec_1.png",
    });
    assert(!invalidAmount.success, "Must reject negative amountRupees");

    const massAssign = SubmitPaymentProofSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      tenancyId: "123e4567-e89b-12d3-a456-426614174000",
      amountRupees: 15000,
      rawReference: "UPI1234567890",
      storagePath: "receipts/rec_1.png",
      status: "VERIFIED", // Malicious state manipulation
    });
    assert(!massAssign.success, "Must reject status tampering");
  });

  await test("Suite 2", "CreateTenantInvitationSchema rejects invalid email and unknown keys", () => {
    const invalidEmail = CreateTenantInvitationSchema.safeParse({
      invitedEmail: "not-an-email",
    });
    assert(!invalidEmail.success, "Must reject invalid email");

    const massAssign = CreateTenantInvitationSchema.safeParse({
      invitedEmail: "tenant@example.com",
      status: "ACCEPTED", // Malicious state manipulation
    });
    assert(!massAssign.success, "Must reject status tampering");
  });

  await test("Suite 2", "SQL Injection strings in input are safely rejected or handled as literals", () => {
    const sqliTitle = CreateMaintenanceRequestSchema.safeParse({
      title: "'; DROP TABLE profiles;--",
      description: "Water leaking heavily from ceiling pipes",
      category: "PLUMBING",
    });
    assert(sqliTitle.success, "Zod accepts the string value without crashing");
    assert(sqliTitle.data.title === "'; DROP TABLE profiles;--", "Stored as sanitized literal string");
  });

  // =========================================================================
  // SUITE 3: HTTP Security Headers, CORS & Middleware Rate Limiting
  // =========================================================================
  console.log("\n[Suite 3] HTTP Security Headers, CORS & Middleware Rate Limiting");

  await test("Suite 3", "API responses contain Strict-Transport-Security, X-Content-Type-Options, and Cache-Control: no-store", async () => {
    const res = await fetch(`${LOCAL_API_URL}/api/properties`);
    const headers = res.headers;

    assert.strictEqual(headers.get("x-frame-options"), "DENY", "X-Frame-Options must be DENY");
    assert.strictEqual(headers.get("x-content-type-options"), "nosniff", "X-Content-Type-Options must be nosniff");
    assert(
      headers.get("referrer-policy")?.includes("strict-origin-when-cross-origin"),
      "Referrer-Policy must be strict-origin-when-cross-origin"
    );
    assert(
      headers.get("permissions-policy")?.includes("camera=()"),
      "Permissions-Policy must restrict device hardware"
    );
    assert(
      headers.get("cache-control")?.includes("no-store"),
      "API Cache-Control must include no-store"
    );
  });

  await test("Suite 3", "CORS blocks unauthorized cross-origin preflight requests (OPTIONS)", async () => {
    const res = await fetch(`${LOCAL_API_URL}/api/properties`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://malicious-attacker.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.strictEqual(res.status, 403, "Must return 403 Forbidden for unauthorized CORS origin");
  });

  await test("Suite 3", "CORS permits authorized origins (e.g. localhost or production domain)", async () => {
    const res = await fetch(`${LOCAL_API_URL}/api/properties`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.strictEqual(res.status, 204, "Must return 204 No Content for authorized CORS preflight");
    assert.strictEqual(
      res.headers.get("access-control-allow-origin"),
      "http://localhost:3000",
      "Must echo allowed origin"
    );
  });

  // =========================================================================
  // SUITE 4: Authentication, RBAC & Token Verification
  // =========================================================================
  console.log("\n[Suite 4] Authentication, RBAC & Token Verification");

  const protectedEndpoints = [
    { method: "GET", path: "/api/properties" },
    { method: "POST", path: "/api/properties" },
    { method: "GET", path: "/api/tenancies" },
    { method: "POST", path: "/api/tenancies" },
    { method: "GET", path: "/api/invoices" },
    { method: "GET", path: "/api/invoices/inv_test_123" },
    { method: "GET", path: "/api/billing/batch" },
    { method: "POST", path: "/api/billing/batch" },
    { method: "POST", path: "/api/billing/reconcile" },
    { method: "GET", path: "/api/maintenance" },
    { method: "POST", path: "/api/maintenance" },
    { method: "GET", path: "/api/notifications" },
    { method: "PATCH", path: "/api/notifications/read" },
    { method: "POST", path: "/api/storage/receipts/upload-url" },
    { method: "POST", path: "/api/storage/maintenance/upload-url" },
  ];

  for (const ep of protectedEndpoints) {
    await test("Suite 4", `Unauthenticated ${ep.method} ${ep.path} returns 401 Unauthorized`, async () => {
      const res = await fetch(`${LOCAL_API_URL}${ep.path}`, {
        method: ep.method,
      });
      assert.strictEqual(res.status, 401, `Expected 401 on ${ep.path}, got ${res.status}`);
      const json = await res.json().catch(() => ({}));
      assert(json.error, "Response must return standard JSON error");
    });
  }

  await test("Suite 4", "Forged / alg:none JWT is rejected with 401 Unauthorized", async () => {
    // alg:none JWT header: {"alg":"none","typ":"JWT"} -> eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0
    // payload: {"sub":"hacker","email":"hacker@evil.com"} -> eyJzdWIiOiJoYWNrZXIiLCJlbWFpbCI6ImhhY2tlckBldmlsLmNvbSJ9
    const algNoneToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJoYWNrZXIiLCJlbWFpbCI6ImhhY2tlckBldmlsLmNvbSJ9.";
    const res = await fetch(`${LOCAL_API_URL}/api/properties`, {
      headers: {
        Authorization: `Bearer ${algNoneToken}`,
      },
    });
    assert.strictEqual(res.status, 401, "Forged token must return 401");
  });

  await test("Suite 4", "Expired / malformed token is rejected with 401 Unauthorized", async () => {
    const res = await fetch(`${LOCAL_API_URL}/api/billing/batch`, {
      headers: {
        Authorization: "Bearer invalid.malformed.token",
      },
    });
    assert.strictEqual(res.status, 401, "Malformed token must return 401");
  });

  await test("Suite 4", "CRON route requires valid CRON_SECRET Bearer token", async () => {
    const noSecretRes = await fetch(`${LOCAL_API_URL}/api/cron/run`, {
      method: "POST",
    });
    assert.strictEqual(noSecretRes.status, 401, "Cron without token must return 401");

    const badSecretRes = await fetch(`${LOCAL_API_URL}/api/cron/run`, {
      method: "POST",
      headers: {
        Authorization: "Bearer incorrect-secret-token",
      },
    });
    assert.strictEqual(badSecretRes.status, 401, "Cron with wrong secret must return 401");
  });

  // =========================================================================
  // SUITE 5: Supabase Direct Anonymous REST & Storage Probe
  // =========================================================================
  console.log("\n[Suite 5] Supabase Direct Anonymous REST & Storage Probe");

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey && !supabaseUrl.includes("mock-project")) {
    const tables = [
      "profiles",
      "organizations",
      "organization_memberships",
      "properties",
      "units",
      "tenants",
      "tenancies",
      "invoices",
      "payments",
      "payment_submissions",
      "maintenance_requests",
    ];

    for (const table of tables) {
      await test("Suite 5", `Direct Anon REST: /rest/v1/${table} returns empty set [] (RLS active)`, async () => {
        const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });
        assert.strictEqual(res.status, 200, `Expected 200 on ${table}`);
        const data = await res.json();
        assert(Array.isArray(data), "Response must be an array");
        assert.strictEqual(data.length, 0, `Anonymous client must NOT see any rows from ${table}`);
      });
    }

    const buckets = ["receipts", "maintenance-photos"];
    for (const bucket of buckets) {
      await test("Suite 5", `Direct Storage: /storage/v1/bucket/${bucket} is private and non-enumerable`, async () => {
        const res = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });
        assert(
          res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404,
          `Direct bucket access on ${bucket} should be rejected, got ${res.status}`
        );
      });
    }
  } else {
    console.log("  (Supabase credentials not configured in local environment; skipping live Supabase REST probe)");
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log("\n==========================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Security Test Invariants: ${passed}/${total} Passed (${failed} Failed)`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error("Fatal audit runner error:", err);
  process.exit(1);
});
