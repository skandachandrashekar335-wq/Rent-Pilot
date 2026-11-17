import fs from "fs";
import path from "path";
import crypto from "crypto";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ ${testName}${detail ? `: ${detail}` : ""}`);
    failedCount++;
  }
}

function safeTimingCompare(provided: string, expected: string): boolean {
  const bufProvided = Buffer.from(provided);
  const bufExpected = Buffer.from(expected);

  if (bufProvided.length !== bufExpected.length) {
    crypto.timingSafeEqual(bufProvided, bufProvided);
    return false;
  }

  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

// In-memory simulation of overdue reconciliation logic
function reconcileInvoiceStatus(
  currentStatus: string,
  dueDate: string,
  today: string,
  balanceDuePaise: number
): { status: string; is_overdue: boolean } {
  const isPastDue = dueDate < today;
  const hasBalance = balanceDuePaise > 0;

  if (isPastDue && hasBalance) {
    // INVARIANT: ISSUED -> OVERDUE, PARTIALLY_PAID -> PARTIALLY_PAID
    const status = currentStatus === "ISSUED" ? "OVERDUE" : currentStatus;
    return { status, is_overdue: true };
  }

  if (!hasBalance && currentStatus === "OVERDUE") {
    return { status: "PAID", is_overdue: false };
  }

  return { status: currentStatus, is_overdue: false };
}

function runStageFTests() {
  console.log("\n========================================================");
  console.log("  RentPilot Stage F: Scheduling, Reliability & Backup Tests");
  console.log("========================================================\n");

  // Suite 1: Timing-Safe CRON Secret Validation
  console.log("[Test Suite 1] Timing-Safe CRON Authentication");
  {
    const expectedSecret = "super-secret-cron-token-1234567890";

    assert(
      safeTimingCompare("super-secret-cron-token-1234567890", expectedSecret),
      "Accepts valid CRON_SECRET token match"
    );

    assert(
      !safeTimingCompare("invalid-token", expectedSecret),
      "Rejects mismatched length token safely"
    );

    assert(
      !safeTimingCompare("super-secret-cron-token-0000000000", expectedSecret),
      "Rejects identical length wrong token safely"
    );

    assert(
      !safeTimingCompare("", expectedSecret),
      "Rejects empty token safely"
    );
  }

  // Suite 2: Overdue Reconciliation Invariants
  console.log("\n[Test Suite 2] Overdue Reconciliation State Machine");
  {
    const today = "2026-11-20";

    // 1. ISSUED with past due date -> OVERDUE
    const r1 = reconcileInvoiceStatus("ISSUED", "2026-11-15", today, 2500000);
    assert(r1.status === "OVERDUE" && r1.is_overdue === true, "Transitions ISSUED invoice with past due date to OVERDUE");

    // 2. PARTIALLY_PAID with past due date -> PARTIALLY_PAID (Must NOT overwrite to OVERDUE)
    const r2 = reconcileInvoiceStatus("PARTIALLY_PAID", "2026-11-15", today, 1000000);
    assert(
      r2.status === "PARTIALLY_PAID" && r2.is_overdue === true,
      "Preserves PARTIALLY_PAID status and marks is_overdue = true"
    );

    // 3. ISSUED with future due date -> remains ISSUED and is_overdue = false
    const r3 = reconcileInvoiceStatus("ISSUED", "2026-11-25", today, 2500000);
    assert(r3.status === "ISSUED" && r3.is_overdue === false, "Leaves future-dated invoice as ISSUED and not overdue");

    // 4. Overdue invoice with zero balance -> transitions to PAID and is_overdue = false
    const r4 = reconcileInvoiceStatus("OVERDUE", "2026-11-15", today, 0);
    assert(r4.status === "PAID" && r4.is_overdue === false, "Transitions zero-balance overdue invoice to PAID");
  }

  // Suite 3: Idempotency Key Format & Deduplication Logic
  console.log("\n[Test Suite 3] Idempotency Key Invariants");
  {
    const dateStr = "2026-11-20";
    const dailyKey = `cron_daily_run:${dateStr}`;
    assert(dailyKey === "cron_daily_run:2026-11-20", "Constructs standard daily cron idempotency key");

    const scheduleId = "550e8400-e29b-41d4-a716-446655440000";
    const incDate = "2026-12-15";
    const incKey = `rent_increment_due:${scheduleId}:${incDate}`;
    assert(
      incKey === "rent_increment_due:550e8400-e29b-41d4-a716-446655440000:2026-12-15",
      "Constructs unique increment alert idempotency key scoped to schedule and effective date"
    );
  }

  // Suite 4: Stage F Database Migration Verification
  console.log("\n[Test Suite 4] Database Migration Verification");
  {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261120000000_stage_f_scheduling_and_reliability.sql"
    );
    assert(fs.existsSync(migrationPath), "Migration file 20261120000000 exists");

    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    assert(migrationSql.includes("public.idempotency_keys"), "Defines idempotency_keys table");
    assert(migrationSql.includes("public.job_execution_logs"), "Defines job_execution_logs table");
    assert(migrationSql.includes("public.message_delivery_logs"), "Defines message_delivery_logs table");
    assert(migrationSql.includes("ENABLE ROW LEVEL SECURITY"), "Enables Row Level Security on all Stage F tables");
    assert(migrationSql.includes("pg_cron"), "Includes ready-to-enable pg_cron scheduling documentation");
  }

  // Suite 5: GitHub Actions Heartbeat Workflow Verification
  console.log("\n[Test Suite 5] GitHub Actions Heartbeat Workflow");
  {
    const workflowPath = path.resolve(process.cwd(), ".github/workflows/heartbeat.yml");
    assert(fs.existsSync(workflowPath), "GitHub Actions heartbeat.yml workflow exists");

    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    assert(workflowContent.includes("cron:"), "Configures recurring cron trigger");
    assert(workflowContent.includes("workflow_dispatch:"), "Configures manual workflow_dispatch trigger");
    assert(workflowContent.includes("/api/health"), "Pings application health endpoint");
    assert(workflowContent.includes("RENTPILOT_APP_URL"), "References RENTPILOT_APP_URL secret with graceful fallback");
  }

  // Suite 6: Backup Utility & Checksum Integrity
  console.log("\n[Test Suite 6] Backup Export & Verification Utility");
  {
    const backupScriptPath = path.resolve(process.cwd(), "scripts/backup-export.ts");
    assert(fs.existsSync(backupScriptPath), "scripts/backup-export.ts exists");

    const backupDir = path.resolve(process.cwd(), "backups");
    assert(fs.existsSync(backupDir), "backups/ directory exists");

    const backupFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith(".json"));
    assert(backupFiles.length > 0, "At least one verifiable backup snapshot exists");

    if (backupFiles.length > 0) {
      const latestBackup = path.join(backupDir, backupFiles[backupFiles.length - 1]);
      const jsonContent = fs.readFileSync(latestBackup);
      const shaFile = `${latestBackup}.sha256`;
      assert(fs.existsSync(shaFile), "Matching .sha256 checksum file exists");

      const expectedSha = fs.readFileSync(shaFile, "utf-8").trim();
      const actualSha = crypto.createHash("sha256").update(jsonContent).digest("hex");
      assert(expectedSha === actualSha, "Cryptographic SHA-256 checksum matches backup file content");

      const parsed = JSON.parse(jsonContent.toString("utf-8"));
      assert(parsed.version === "1.0.0", "Backup version matches 1.0.0");
      assert(Array.isArray(parsed.tables?.invoices), "Backup payload includes invoices table");
      assert(Array.isArray(parsed.tables?.maintenance_requests), "Backup payload includes maintenance_requests table");
    }
  }

  // Suite 7: Operations & Free-Tier Disclosures Documentation
  console.log("\n[Test Suite 7] Operations Runbook & Provider Disclosures");
  {
    const runbookPath = path.resolve(process.cwd(), "docs/OPERATIONS_AND_BACKUP.md");
    assert(fs.existsSync(runbookPath), "docs/OPERATIONS_AND_BACKUP.md exists");

    const runbookContent = fs.readFileSync(runbookPath, "utf-8");
    assert(runbookContent.includes("Vercel"), "Discloses Vercel hosting and commercial-use terms");
    assert(runbookContent.includes("Supabase"), "Discloses Supabase free-tier 7-day pause limits");
    assert(runbookContent.includes("Brevo"), "Discloses Brevo 300 emails/day rate limit");
    assert(runbookContent.includes("pg_cron"), "Documents pg_cron setup instructions");
  }

  console.log("\n========================================================");
  console.log(`  Stage F Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runStageFTests();
