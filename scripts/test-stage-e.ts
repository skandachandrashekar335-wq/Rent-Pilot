import fs from "fs";
import path from "path";
import {
  CreateMaintenanceRequestSchema,
  UpdateMaintenanceRequestSchema,
  MaintenanceUploadUrlSchema,
} from "../src/lib/validation/maintenance";
import { rupeesToPaise, paiseToRupees } from "../src/lib/domain/billing";

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

function runTests() {
  console.log("\n========================================================");
  console.log("  RentPilot Stage E: Maintenance & Operational Tests");
  console.log("========================================================\n");

  // 1. Zod Validation Schemas
  console.log("[Test Suite 1] Maintenance Validation Schemas");
  {
    // Valid request
    const valid = CreateMaintenanceRequestSchema.safeParse({
      title: "Bathroom sink faucet slow drip",
      description: "Bathroom sink faucet slow drip and pipe seal leaking under counter.",
      category: "PLUMBING",
      priority: "MEDIUM",
      photoPaths: ["org/user/1.png", "org/user/2.jpg"],
    });
    assert(valid.success, "Accepts valid maintenance request payload");

    // Invalid: Title too short (< 3 chars)
    const shortTitle = CreateMaintenanceRequestSchema.safeParse({
      title: "No",
      description: "Bathroom sink faucet slow drip and pipe seal leaking under counter.",
      category: "PLUMBING",
      priority: "MEDIUM",
    });
    assert(!shortTitle.success, "Rejects title under 3 characters");

    // Invalid: Description too short (< 10 chars)
    const shortDesc = CreateMaintenanceRequestSchema.safeParse({
      title: "Broken tap",
      description: "Short",
      category: "PLUMBING",
      priority: "MEDIUM",
    });
    assert(!shortDesc.success, "Rejects description under 10 characters");

    // Invalid: Exceeding 4 photos
    const tooManyPhotos = CreateMaintenanceRequestSchema.safeParse({
      title: "Water seepage in bedroom",
      description: "Water seepage on north-facing wall behind wardrobe.",
      category: "STRUCTURAL",
      priority: "HIGH",
      photoPaths: ["p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg", "p5.jpg"],
    });
    assert(!tooManyPhotos.success, "Rejects more than 4 photo attachments per ticket");

    // Invalid Category
    const invalidCat = CreateMaintenanceRequestSchema.safeParse({
      title: "Broken chair",
      description: "Dining chair leg came off completely.",
      category: "FURNITURE", // Not in enum
      priority: "LOW",
    });
    assert(!invalidCat.success, "Rejects unknown category outside approved enum");

    // Valid Urgent Priority
    const urgent = CreateMaintenanceRequestSchema.safeParse({
      title: "Sparking main electrical switchboard",
      description: "Smoke and sparks coming from electrical panel near kitchen.",
      category: "ELECTRICAL",
      priority: "URGENT",
    });
    assert(urgent.success, "Accepts URGENT priority request");
  }

  // 2. Photo Upload Validation
  console.log("\n[Test Suite 2] Photo Upload Whitelist & Size Limits");
  {
    // Valid JPEG, PNG, WebP
    const validJpg = MaintenanceUploadUrlSchema.safeParse({
      filename: "leak.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 2048500, // ~2 MB
    });
    assert(validJpg.success, "Accepts valid JPEG image under 5 MB");

    const validWebp = MaintenanceUploadUrlSchema.safeParse({
      filename: "wall_crack.webp",
      mimeType: "image/webp",
      fileSizeBytes: 4500000, // ~4.5 MB
    });
    assert(validWebp.success, "Accepts valid WebP image under 5 MB");

    // Reject non-image MIME types (PDF, EXE, TXT)
    const rejectPdf = MaintenanceUploadUrlSchema.safeParse({
      filename: "invoice.pdf",
      mimeType: "application/pdf" as unknown as "image/jpeg",
      fileSizeBytes: 100000,
    });
    assert(!rejectPdf.success, "Rejects non-image MIME type (PDF)");

    const rejectExe = MaintenanceUploadUrlSchema.safeParse({
      filename: "malware.exe",
      mimeType: "application/x-msdownload" as unknown as "image/jpeg",
      fileSizeBytes: 50000,
    });
    assert(!rejectExe.success, "Rejects executable binary MIME type");

    // Reject exceeding 5 MB limit
    const rejectLarge = MaintenanceUploadUrlSchema.safeParse({
      filename: "huge_raw_photo.png",
      mimeType: "image/png",
      fileSizeBytes: 5242881, // 5 MB + 1 byte
    });
    assert(!rejectLarge.success, "Rejects image exceeding 5 MB limit");
  }

  // 3. Integer Paise Repair Expense Conversion
  console.log("\n[Test Suite 3] Integer Paise Repair Expense Calculations");
  {
    const expenseRupees = 1250;
    const expensePaise = rupeesToPaise(expenseRupees);
    assert(expensePaise === BigInt(125000), `Converts ₹1,250 to 125,000 paise exactly (got: ${expensePaise})`);
    assert(paiseToRupees(expensePaise) === 1250, "Converts 125,000 paise back to ₹1,250 with zero precision drift");

    // Update schema expense validation
    const updateWithCost = UpdateMaintenanceRequestSchema.safeParse({
      status: "RESOLVED",
      repairCostRupees: 1850,
      paidBy: "OWNER",
      resolutionNotes: "Replaced dual valve ball-cock and washers.",
    });
    assert(updateWithCost.success, "Accepts resolution with positive repair cost and notes");

    const updateNegativeCost = UpdateMaintenanceRequestSchema.safeParse({
      repairCostRupees: -500,
    });
    assert(!updateNegativeCost.success, "Rejects negative repair cost");
  }

  // 4. SQL Migration Invariants Assertions
  console.log("\n[Test Suite 4] SQL Migration Schema & RLS Invariants");
  {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261119000000_stage_e_maintenance_and_notifications.sql"
    );
    assert(fs.existsSync(migrationPath), "Stage E migration file exists");

    const sql = fs.readFileSync(migrationPath, "utf-8");

    assert(
      sql.includes("CREATE TABLE IF NOT EXISTS public.maintenance_requests") &&
      sql.includes("repair_cost_paise BIGINT NOT NULL DEFAULT 0"),
      "Creates maintenance_requests with repair_cost_paise BIGINT"
    );

    assert(
      sql.includes("CREATE TABLE IF NOT EXISTS public.maintenance_updates") &&
      sql.includes("is_internal_note BOOLEAN NOT NULL DEFAULT false"),
      "Creates maintenance_updates table with is_internal_note flag"
    );

    assert(
      sql.includes("CREATE TABLE IF NOT EXISTS public.notifications") &&
      sql.includes("recipient_profile_id UUID NOT NULL"),
      "Creates notifications table with recipient_profile_id"
    );

    assert(
      sql.includes("INSERT INTO storage.buckets (id, name, public") &&
      sql.includes("'maintenance-photos'") &&
      sql.includes("false"),
      "Configures private 'maintenance-photos' storage bucket (public = false)"
    );

    assert(
      sql.includes("CREATE POLICY \"maint_requests_manage_org_staff\"") &&
      sql.includes("CREATE POLICY \"maint_requests_select_tenant\""),
      "Configures RLS policies on maintenance_requests"
    );

    assert(
      sql.includes("CREATE POLICY \"maint_updates_select_tenant\"") &&
      sql.includes("is_internal_note = false"),
      "Enforces RLS policy hiding internal notes from tenants in maintenance_updates"
    );

    assert(
      sql.includes("CREATE POLICY \"notifications_select_recipient\""),
      "Enforces RLS policy isolating notifications to recipient"
    );
  }

  // 5. Trilingual Localization Parity (EN, KN, HI)
  console.log("\n[Test Suite 5] Trilingual Localization Parity (Zero Missing Keys)");
  {
    const enPath = path.join(process.cwd(), "src", "messages", "en.json");
    const knPath = path.join(process.cwd(), "src", "messages", "kn.json");
    const hiPath = path.join(process.cwd(), "src", "messages", "hi.json");

    const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
    const kn = JSON.parse(fs.readFileSync(knPath, "utf-8"));
    const hi = JSON.parse(fs.readFileSync(hiPath, "utf-8"));

    function extractKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      let keys: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          keys = keys.concat(extractKeys(value as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    const enKeys = extractKeys(en);
    const knKeys = new Set(extractKeys(kn));
    const hiKeys = new Set(extractKeys(hi));

    const missingInKn = enKeys.filter((k) => !knKeys.has(k));
    const missingInHi = enKeys.filter((k) => !hiKeys.has(k));

    assert(
      missingInKn.length === 0,
      `Kannada dictionary has 100% key parity with English (${enKeys.length} keys total)`,
      missingInKn.join(", ")
    );

    assert(
      missingInHi.length === 0,
      `Hindi dictionary has 100% key parity with English (${enKeys.length} keys total)`,
      missingInHi.join(", ")
    );

    assert(
      enKeys.includes("maintenance.title") &&
      enKeys.includes("maintenance.categories.PLUMBING") &&
      enKeys.includes("notifications.title"),
      "Contains all new Stage E maintenance and notification dictionary keys"
    );
  }

  console.log("\n========================================================");
  console.log(`  Tests Passed: ${passedCount}`);
  console.log(`  Tests Failed: ${failedCount}`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
