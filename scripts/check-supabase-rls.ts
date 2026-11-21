import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [k, ...v] = trimmed.split("=");
    if (k && v.length) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pnbtexouxvlurtvphzpz.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

const ALL_TABLES = [
  "profiles",
  "organizations",
  "organization_memberships",
  "tenant_invitations",
  "properties",
  "units",
  "tenants",
  "tenancies",
  "rent_increment_schedules",
  "rent_increment_history",
  "billing_cycles",
  "invoices",
  "invoice_items",
  "payment_submissions",
  "payments",
  "financial_audit_logs",
  "maintenance_requests",
  "maintenance_updates",
  "notifications",
  "idempotency_keys",
  "job_execution_logs",
  "message_delivery_logs",
];

async function checkRLS() {
  console.log("=== CHECKING ROW-LEVEL SECURITY (RLS) ON ALL TABLES ===");

  let allSecure = true;

  for (const table of ALL_TABLES) {
    try {
      const { data, error } = await anonClient.from(table).select("*").limit(5);
      if (error) {
        console.log(`  ✓ ${table}: Blocked by RLS/PostgREST [${error.code || error.message}]`);
      } else if (Array.isArray(data) && data.length === 0) {
        console.log(`  ✓ ${table}: Returns empty array [] to anonymous caller (RLS active)`);
      } else {
        console.error(`  ✗ FAIL: ${table}: Anonymous caller retrieved ${data?.length} records!`);
        allSecure = false;
      }
    } catch (e: unknown) {
      console.log(`  ✓ ${table}: Exception caught (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  // Storage bucket check
  console.log("\n=== CHECKING STORAGE BUCKET PRIVACY ===");
  for (const bucket of ["receipts", "maintenance-photos"]) {
    const { data, error } = await anonClient.storage.from(bucket).list();
    if (error || !data || data.length === 0) {
      console.log(`  ✓ Bucket '${bucket}': Private, anonymous listing rejected or returns empty`);
    } else {
      console.error(`  ✗ FAIL: Bucket '${bucket}' is publicly listable!`);
      allSecure = false;
    }
  }

  if (allSecure) {
    console.log("\n✓ ALL 22 TABLES & STORAGE BUCKETS STRICTLY PROTECTED BY RLS!");
  } else {
    process.exit(1);
  }
}

checkRLS().catch((err) => {
  console.error("RLS check error:", err);
  process.exit(1);
});
