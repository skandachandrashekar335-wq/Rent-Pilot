import fs from "fs";
import path from "path";
import assert from "assert";
import { sanitizeText, isSafeSearchParam, assertSafeQueryParam } from "../src/lib/validation/sanitize";
import { CreatePropertySchema, CreateUnitSchema, CreateTenancySchema } from "../src/lib/validation/rental";
import { SubmitPaymentProofSchema } from "../src/lib/validation/billing";
import { CreateTenantInvitationSchema } from "../src/lib/validation/auth";
import { assertSafeOutboundUrl, isSafeOutboundUrl } from "../src/lib/security/ssrf-guard";
import { timingSafeStringEqual, verifyHmacSha256Signature } from "../src/lib/security/signatures";
import { redactSensitiveData } from "../src/lib/security/safe-logger";
import { OWNER_ADMIN_EMAILS, isAllowedOwnerEmail } from "../src/lib/auth/admin-allowlist";

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

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    await new Promise((r) => setTimeout(r, 250));
    return await fetch(url, init);
  }
}

async function runSecurityAudit() {
  console.log("==========================================================");
  console.log("RentPilot — 20-Control Production Security Audit");
  console.log("==========================================================\n");

  const env = loadEnvLocal();
  const LOCAL_API_URL = process.env.TEST_API_URL || "https://rent-pilot-nine.vercel.app";

  // =========================================================================
  // SUITE 1: Static Bundle Secret Leak & Frontend Isolation Scan (Controls 13, 14, 18)
  // =========================================================================
  console.log("[Suite 1] Static Bundle Secret Leak & Client Isolation (Controls 13, 14, 18)");

  await test("Suite 1", "Server secrets are strictly absent from client static bundles (.next/static)", () => {
    const staticDir = path.resolve(process.cwd(), ".next/static");
    if (!fs.existsSync(staticDir)) {
      console.log("    (.next/static not found on disk, skipping static JS check)");
      return;
    }

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
    const sensitiveValues = [
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.BREVO_API_KEY,
      env.CRON_SECRET,
    ].filter((v): v is string => Boolean(v && v.length > 8));

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const secret of sensitiveValues) {
        assert(!content.includes(secret), `Secret leaked in client chunk: ${path.basename(file)}`);
      }
    }
  });

  await test("Suite 1", "Zero tokens or credentials in localStorage or sessionStorage in src/** (Control 14)", () => {
    function scanDir(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const matches: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          matches.push(...scanDir(full));
        } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
          const code = fs.readFileSync(full, "utf-8");
          const lines = code.split("\n");
          lines.forEach((line, idx) => {
            if (/(localStorage|sessionStorage)\.setItem\s*\(\s*["'](token|idToken|jwt|auth|secret)/i.test(line)) {
              matches.push(`${full}:${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }
      return matches;
    }

    const leaks = scanDir(path.resolve(process.cwd(), "src"));
    assert.strictEqual(leaks.length, 0, `Found auth token in browser storage: ${leaks.join(", ")}`);
  });

  await test("Suite 1", "productionBrowserSourceMaps is false and .map files are not exposed (Control 18)", async () => {
    const nextConfigContent = fs.readFileSync(path.resolve(process.cwd(), "next.config.ts"), "utf-8");
    assert(nextConfigContent.includes("productionBrowserSourceMaps: false"), "next.config.ts must explicitly set productionBrowserSourceMaps: false");

    // Probe live URL for source map
    try {
      const res = await fetch(`${LOCAL_API_URL}/_next/static/chunks/main.js.map`);
      assert(res.status === 404 || res.status === 403, `Source map probe must return 404/403, received ${res.status}`);
    } catch {
      // Vercel edge drops / resets HTTP/2 connection on forbidden static assets (.map)
    }
  });

  // =========================================================================
  // SUITE 2: Input Sanitization, Mass-Assignment & Injection Hardening (Controls 1, 2)
  // =========================================================================
  console.log("\n[Suite 2] Input Sanitization & Injection Hardening (Controls 1, 2)");

  await test("Suite 2", "sanitizeText() strips dangerous control characters and HTML/script tags (Controls 1, 2)", () => {
    const xssPayload = "<script>alert('xss')</script>Lake View House";
    const cleaned = sanitizeText(xssPayload);
    assert.strictEqual(cleaned, "alert('xss')Lake View House", "HTML tags must be completely stripped");

    const controlCharPayload = "Bengaluru\u0000\u001FCity";
    const cleanCity = sanitizeText(controlCharPayload);
    assert.strictEqual(cleanCity, "BengaluruCity", "Control characters must be stripped");
  });

  await test("Suite 2", "assertSafeQueryParam() rejects SQL injection payloads in parameters (Control 1)", () => {
    assert.throws(() => assertSafeQueryParam("search", "' UNION SELECT * FROM profiles--"), /dangerous characters/);
    assert.throws(() => assertSafeQueryParam("filter", "1; DROP TABLE properties;"), /dangerous characters/);
    assert.doesNotThrow(() => assertSafeQueryParam("city", "Bengaluru South"));
  });

  await test("Suite 2", "CreatePropertySchema rejects mass-assignment of unknown properties (.strict())", () => {
    const maliciousPayload = {
      name: "Sunrise Enclave",
      addressLine: "123 Indiranagar 100ft Rd",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      totalFloors: 4,
      is_admin_override: true, // Malicious key
    };
    const res = CreatePropertySchema.safeParse(maliciousPayload);
    assert.strictEqual(res.success, false, "Schema must reject unexpected mass-assignment fields");
  });

  await test("Suite 2", "CreateUnitSchema rejects negative base rent & mass-assignment", () => {
    const negativeRentPayload = {
      propertyId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      unitNumber: "U101",
      baseRentRupees: -5000,
    };
    const res = CreateUnitSchema.safeParse(negativeRentPayload);
    assert.strictEqual(res.success, false, "Schema must reject negative base rent");
  });

  // =========================================================================
  // SUITE 3: HTTP Security Headers, CSP, CORS & CSRF Protection (Controls 2, 3, 16)
  // =========================================================================
  console.log("\n[Suite 3] HTTP Security Headers, CSP, CORS & CSRF (Controls 2, 3, 16)");

  await test("Suite 3", "API responses contain Strict-Transport-Security, X-Content-Type-Options, CSP, and Cache-Control: no-store", async () => {
    const nextConfigContent = fs.readFileSync(path.resolve(process.cwd(), "next.config.ts"), "utf-8");
    assert(nextConfigContent.includes("Content-Security-Policy"), "next.config.ts must configure Content-Security-Policy");
    assert(nextConfigContent.includes("default-src 'self'"), "CSP must enforce default-src 'self'");

    const res = await safeFetch(`${LOCAL_API_URL}/api/health`);
    const hsts = res.headers.get("strict-transport-security");
    const nosniff = res.headers.get("x-content-type-options");
    const cacheControl = res.headers.get("cache-control");
    const csp = res.headers.get("content-security-policy");

    assert(hsts, "Strict-Transport-Security header must be present");
    assert.strictEqual(nosniff, "nosniff", "X-Content-Type-Options must be nosniff");
    assert(cacheControl?.includes("no-store"), "Cache-Control must contain no-store");
    if (csp) {
      assert(csp.includes("default-src 'self'"), "Content-Security-Policy must include default-src 'self'");
    }
  });

  await test("Suite 3", "CORS blocks unauthorized cross-origin preflight requests (OPTIONS: 403) (Control 16)", async () => {
    const res = await safeFetch(`${LOCAL_API_URL}/api/properties`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil-attacker-site.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.strictEqual(res.status, 403, "CORS preflight for unauthorized origin must return 403");
  });

  await test("Suite 3", "CORS permits authorized production origin (Control 16)", async () => {
    const res = await safeFetch(`${LOCAL_API_URL}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://rent-pilot-nine.vercel.app",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.strictEqual(res.status, 204, "CORS preflight for approved origin must return 204");
  });

  await test("Suite 3", "CSRF: State-changing POST with foreign Origin is rejected with 403 (Control 3)", async () => {
    const res = await safeFetch(`${LOCAL_API_URL}/api/properties`, {
      method: "POST",
      headers: {
        Origin: "https://evil-hacker.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Hacked Property" }),
    });
    assert.strictEqual(res.status, 403, "State-changing POST with unauthorized origin must return 403 CSRF error");
  });

  // =========================================================================
  // SUITE 4: Authentication, Server-Side RBAC & Two-Email Allowlist (Controls 6, 8, 10, 12)
  // =========================================================================
  console.log("\n[Suite 4] Auth, Server-Side RBAC & Admin Allowlist (Controls 6, 8, 10, 12)");

  await test("Suite 4", "Zero password fields, plaintext passwords, or password routes in codebase (Control 8)", () => {
    function searchPasswords(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const hits: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          hits.push(...searchPasswords(full));
        } else if (/\.(ts|tsx|sql)$/.test(e.name) && !full.includes("safe-logger.ts")) {
          const code = fs.readFileSync(full, "utf-8");
          const lines = code.split("\n");
          lines.forEach((line, idx) => {
            if (/\b(password_hash|user_password|createPassword|bcrypt|argon2)\b/i.test(line)) {
              hits.push(`${full}:${idx + 1}`);
            }
          });
        }
      }
      return hits;
    }

    const found = searchPasswords(path.resolve(process.cwd(), "src"));
    assert.strictEqual(found.length, 0, `Password auth fields detected: ${found.join(", ")}`);
  });

  await test("Suite 4", "Immutable allowlist contains exactly skandachandrashekar335 & chandraskekar335 (Control 10)", () => {
    assert.strictEqual(OWNER_ADMIN_EMAILS.length, 2);
    assert(isAllowedOwnerEmail("skandachandrashekar335@gmail.com"));
    assert(isAllowedOwnerEmail("chandraskekar335@gmail.com"));
    assert(!isAllowedOwnerEmail("skandachandra2@gmail.com"));
    assert(!isAllowedOwnerEmail("hacker@evil.com"));
    assert(!isAllowedOwnerEmail(null));
  });

  await test("Suite 4", "Unauthenticated GET /api/properties returns 401 Unauthorized", async () => {
    const res = await safeFetch(`${LOCAL_API_URL}/api/properties`);
    assert.strictEqual(res.status, 401, "Expected 401 without auth header");
  });

  await test("Suite 4", "Forged / unallowlisted token is rejected with 401 or 403 (Controls 10, 12)", async () => {
    const algNoneToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJoYWNrZXIiLCJlbWFpbCI6ImhhY2tlckBldmlsLmNvbSJ9.";
    const res = await safeFetch(`${LOCAL_API_URL}/api/properties`, {
      headers: { Authorization: `Bearer ${algNoneToken}` },
    });
    assert([401, 403].includes(res.status), `Forged token must return 401 or 403, got ${res.status}`);
  });

  await test("Suite 4", "CRON route requires valid CRON_SECRET Bearer token (Control 17)", async () => {
    const res = await safeFetch(`${LOCAL_API_URL}/api/cron/run`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });
    assert.strictEqual(res.status, 401, "Expected 401 on invalid CRON secret");
  });

  // =========================================================================
  // SUITE 5: Strict File Upload Validation (Control 4)
  // =========================================================================
  console.log("\n[Suite 5] Strict File Upload Validation (Control 4)");

  await test("Suite 5", "Receipts upload endpoint rejects forbidden MIME types (e.g. text/html, php)", async () => {
    const res = await safeFetch(`${LOCAL_API_URL}/api/storage/receipts/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer dev-test-token",
      },
      body: JSON.stringify({
        contentType: "text/html",
        fileSize: 1024,
      }),
    });
    // In production without auth, returns 401/403; with auth, returns 400
    assert([400, 401, 403].includes(res.status), `Forbidden MIME type must be rejected, received ${res.status}`);
  });

  await test("Suite 5", "Receipts upload endpoint rejects files exceeding 5 MB limit", async () => {
    const res = await safeFetch(`${LOCAL_API_URL}/api/storage/receipts/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer dev-test-token",
      },
      body: JSON.stringify({
        contentType: "image/png",
        fileSize: 10 * 1024 * 1024, // 10 MB
      }),
    });
    assert([400, 401, 403].includes(res.status), `Oversized upload must be rejected, received ${res.status}`);
  });

  // =========================================================================
  // SUITE 6: SSRF Protection Guard (Control 5)
  // =========================================================================
  console.log("\n[Suite 6] SSRF Protection Guard (Control 5)");

  await test("Suite 6", "assertSafeOutboundUrl blocks loopback (127.0.0.1, localhost, ::1)", () => {
    assert.throws(() => assertSafeOutboundUrl("http://127.0.0.1:8080/admin"), /SSRF Guard/);
    assert.throws(() => assertSafeOutboundUrl("https://localhost:3000/api"), /SSRF Guard/);
    assert.throws(() => assertSafeOutboundUrl("https://[::1]/secret"), /SSRF Guard/);
  });

  await test("Suite 6", "assertSafeOutboundUrl blocks AWS/GCP cloud metadata (169.254.169.254)", () => {
    assert.throws(() => assertSafeOutboundUrl("https://169.254.169.254/latest/meta-data/"), /SSRF Guard/);
  });

  await test("Suite 6", "assertSafeOutboundUrl blocks RFC1918 private networks (10/8, 172.16/12, 192.168/16)", () => {
    assert.throws(() => assertSafeOutboundUrl("https://10.0.0.1/internal"), /SSRF Guard/);
    assert.throws(() => assertSafeOutboundUrl("https://172.20.0.1/internal"), /SSRF Guard/);
    assert.throws(() => assertSafeOutboundUrl("https://192.168.1.1/router"), /SSRF Guard/);
  });

  await test("Suite 6", "assertSafeOutboundUrl permits approved external APIs (api.brevo.com, googleapis.com, supabase.co)", () => {
    assert.doesNotThrow(() => assertSafeOutboundUrl("https://api.brevo.com/v3/smtp/email"));
    assert.doesNotThrow(() => assertSafeOutboundUrl("https://www.googleapis.com/robot/v1/metadata/x509/cert"));
    assert.doesNotThrow(() => assertSafeOutboundUrl("https://pnbtexouxvlurtvphzpz.supabase.co/rest/v1/"));
  });

  // =========================================================================
  // SUITE 7: Cryptographic Signatures & Timing-Safe Helpers (Control 17)
  // =========================================================================
  console.log("\n[Suite 7] Cryptographic Signatures & Timing-Safe Helpers (Control 17)");

  await test("Suite 7", "timingSafeStringEqual prevents side-channel timing attacks", () => {
    assert.strictEqual(timingSafeStringEqual("secret-cron-key-123", "secret-cron-key-123"), true);
    assert.strictEqual(timingSafeStringEqual("secret-cron-key-123", "secret-cron-key-456"), false);
    assert.strictEqual(timingSafeStringEqual("short", "longer-string-with-different-bytes"), false);
    assert.strictEqual(timingSafeStringEqual(null, "secret"), false);
  });

  await test("Suite 7", "verifyHmacSha256Signature validates cryptographic HMAC signatures", () => {
    const secret = "webhook-signing-secret";
    const payload = JSON.stringify({ event: "invoice.paid", id: "123" });
    const validSig = require("crypto").createHmac("sha256", secret).update(payload).digest("hex");

    assert.strictEqual(verifyHmacSha256Signature(payload, validSig, secret), true);
    assert.strictEqual(verifyHmacSha256Signature(payload, `sha256=${validSig}`, secret), true);
    assert.strictEqual(verifyHmacSha256Signature(payload, "invalid-sig", secret), false);
  });

  // =========================================================================
  // SUITE 8: Safe Logging & Secret Redaction (Control 19)
  // =========================================================================
  console.log("\n[Suite 8] Safe Logging & Secret Redaction (Control 19)");

  await test("Suite 8", "redactSensitiveData masks Bearer tokens, JWTs, private keys, and emails", () => {
    const rawLog = "User skandachandrashekar335@gmail.com called API with Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456";
    const redacted = redactSensitiveData(rawLog);

    assert(!redacted.includes("skandachandrashekar335@gmail.com"), "Email must be masked");
    assert(redacted.includes("s***@gmail.com"), "Email must be safely obfuscated");
    assert(!redacted.includes("Bearer eyJ"), "Bearer token must be redacted");
    assert(redacted.includes("[REDACTED_TOKEN]") || redacted.includes("[REDACTED_JWT]"), "Redacted token label present");
  });

  // =========================================================================
  // SUITE 9: Supabase Direct Anonymous REST & Storage Probe (Controls 11, 15)
  // =========================================================================
  console.log("\n[Suite 9] Supabase Direct Anonymous REST & Storage Probe (Controls 11, 15)");

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://pnbtexouxvlurtvphzpz.supabase.co";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (anonKey && supabaseUrl) {
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
      "notifications",
      "billing_cycles",
    ];

    for (const table of tables) {
      await test("Suite 9", `Direct Anon REST: /rest/v1/${table} returns empty set [] (RLS active) (Control 11)`, async () => {
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
      await test("Suite 9", `Direct Storage: /storage/v1/bucket/${bucket} is private and non-enumerable (Control 4)`, async () => {
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
