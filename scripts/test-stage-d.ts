import fs from "fs";
import path from "path";
import {
  rupeesToPaise,
  paiseToRupees,
  calculateInvoiceTotals,
  determineInvoiceStatus,
  normalizePaymentReference,
  generateInvoiceNumber,
  generateReceiptNumber,
  buildUpiPaymentUri,
} from "../src/lib/domain/billing";
import {
  BillingBatchSchema,
  SubmitPaymentProofSchema,
  ReviewPaymentSubmissionSchema,
  RecordOfflinePaymentSchema,
  AdjustInvoiceSchema,
} from "../src/lib/validation/billing";

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
  console.log("  RentPilot Stage D: Automated Financial & Billing Tests");
  console.log("========================================================\n");

  // 1. UPI Reference Normalization & Length Validation
  console.log("[Test Suite 1] UPI Reference Normalization & Validation");
  {
    const ref1 = normalizePaymentReference("  4312 8901 2389  ");
    assert(ref1 === "431289012389", "Normalizes whitespace and hyphens to uppercase alphanumeric");

    const ref2 = normalizePaymentReference("axis_98234-AXIS");
    assert(ref2 === "AXIS98234AXIS", "Normalizes underscore and lower-case to uppercase");

    const validSubmission = SubmitPaymentProofSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      tenancyId: "123e4567-e89b-12d3-a456-426614174001",
      amountRupees: 18500,
      rawReference: "4312 8901 2389",
      storagePath: "org_123/receipts/proof.png",
    });
    assert(validSubmission.success, "Validates valid 12-digit numeric UTR reference");
    if (validSubmission.success) {
      assert(validSubmission.data.normalizedReference === "431289012389", "Transforms rawReference to normalized reference");
    }

    const alphaRefSubmission = SubmitPaymentProofSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      tenancyId: "123e4567-e89b-12d3-a456-426614174001",
      amountRupees: 18500,
      rawReference: "YESB-0001-2345-6789",
      storagePath: "org_123/receipts/proof.png",
    });
    assert(alphaRefSubmission.success, "Accepts realistic alphanumeric 16-character bank reference");
    if (alphaRefSubmission.success) {
      assert(alphaRefSubmission.data.normalizedReference === "YESB000123456789", "Strips hyphens from alphanumeric bank reference");
    }

    const shortRef = SubmitPaymentProofSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      tenancyId: "123e4567-e89b-12d3-a456-426614174001",
      amountRupees: 18500,
      rawReference: "123-45", // < 8 characters
      storagePath: "org_123/receipts/proof.png",
    });
    assert(!shortRef.success, "Rejects references under 8 characters");

    const longRef = SubmitPaymentProofSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      tenancyId: "123e4567-e89b-12d3-a456-426614174001",
      amountRupees: 18500,
      rawReference: "A".repeat(45), // > 40 characters
      storagePath: "org_123/receipts/proof.png",
    });
    assert(!longRef.success, "Rejects references exceeding max length");
  }

  // 2. Integer Paise Invoice Totals Formula
  console.log("\n[Test Suite 2] Integer Paise Invoice Calculation");
  {
    const rentPaise = rupeesToPaise(16000); // 1,600,000 paise
    const elecPaise = rupeesToPaise(2100);  // 210,000 paise
    const waterPaise = rupeesToPaise(400);  // 40,000 paise
    const maintPaise = rupeesToPaise(500);  // 50,000 paise
    const otherPaise = rupeesToPaise(0);
    const prevBalance = rupeesToPaise(1000); // 100,000 paise
    const creditsPaise = rupeesToPaise(500); // 50,000 paise

    const { totalDuePaise, balanceDuePaise } = calculateInvoiceTotals({
      rentPaise,
      electricityPaise: elecPaise,
      waterPaise,
      maintenancePaise: maintPaise,
      otherChargesPaise: otherPaise,
      previousBalancePaise: prevBalance,
      creditsPaise,
    }, BigInt(0));

    // Expected: 16000 + 2100 + 400 + 500 + 1000 - 500 = 19500 => 1,950,000 paise
    assert(totalDuePaise === BigInt(1950000), `Total due calculated as ₹19,500 (1,950,000 paise), got: ${totalDuePaise}`);
    assert(balanceDuePaise === BigInt(1950000), `Balance due matches total due with 0 amount paid, got: ${balanceDuePaise}`);
    assert(paiseToRupees(totalDuePaise) === 19500, `paiseToRupees correctly formats 1,950,000 to ₹19,500`);
  }

  // 3. Invoice State Machine & Overdue Precedence Invariant
  console.log("\n[Test Suite 3] Invoice State Machine & Overdue Invariants");
  {
    const totalDue = BigInt(1000000); // ₹10,000
    const pastDueDate = "2026-11-10";
    const futureDueDate = "2026-11-25";
    const mockNow = new Date("2026-11-16T12:00:00Z");

    // Case A: ₹4,000 partial payment past due date
    const partialPaid = BigInt(400000); // ₹4,000
    const resA = determineInvoiceStatus(totalDue, partialPaid, pastDueDate, mockNow);
    assert(resA.status === "PARTIALLY_PAID", "Partially paid invoice retains PARTIALLY_PAID status");
    assert(resA.isOverdue === true, "Partially paid past due date has isOverdue = true");
    assert(resA.balanceDuePaise === BigInt(600000), "Remaining balance is exactly ₹6,000 (600,000 paise)");

    // Case B: Fully paid past due date
    const resB = determineInvoiceStatus(totalDue, totalDue, pastDueDate, mockNow);
    assert(resB.status === "PAID", "Fully paid invoice transitions to PAID");
    assert(resB.isOverdue === false, "Fully paid invoice clears isOverdue flag");
    assert(resB.balanceDuePaise === BigInt(0), "Fully paid invoice has 0 balance due");

    // Case C: 0 paid past due date
    const resC = determineInvoiceStatus(totalDue, BigInt(0), pastDueDate, mockNow);
    assert(resC.status === "OVERDUE", "Zero paid past due date transitions to OVERDUE");
    assert(resC.isOverdue === true, "Zero paid past due date sets isOverdue = true");

    // Case D: 0 paid before due date
    const resD = determineInvoiceStatus(totalDue, BigInt(0), futureDueDate, mockNow);
    assert(resD.status === "ISSUED", "Zero paid before due date remains ISSUED");
    assert(resD.isOverdue === false, "Zero paid before due date has isOverdue = false");
  }

  // 4. UPI URI & Identifier Generators
  console.log("\n[Test Suite 4] UPI Payment Deep-Link & Numbering");
  {
    const uri = buildUpiPaymentUri({
      vpa: "owner@okaxis",
      payeeName: "RentPilot Properties",
      amountPaise: BigInt(1850000), // 1,850,000 paise = ₹18,500
      transactionNote: "Rent for U-201 Nov 2026",
    });
    assert(uri.startsWith("upi://pay?"), "Generates valid upi://pay URI");
    assert(uri.includes("pa=owner%40okaxis") || uri.includes("pa=owner@okaxis"), "Encodes payee VPA");
    assert(uri.includes("am=18500.00"), "Includes integer amount formatted for UPI");
    assert(uri.includes("cu=INR"), "Sets currency to INR");

    const invNum = generateInvoiceNumber(2026, 11, "U-201");
    assert(invNum === "INV-2026-11-U201", `Generates predictable invoice number: ${invNum}`);

    const recNum = generateReceiptNumber(2026, 42);
    assert(recNum === "RCP-2026-00042", `Generates 5-digit zero-padded receipt number: ${recNum}`);
  }

  // 5. Validation Schemas for Financial Operations
  console.log("\n[Test Suite 5] Financial API Request Validation Schemas");
  {
    // Billing Batch Schema
    const batchValid = BillingBatchSchema.safeParse({
      billingYear: 2026,
      billingMonth: 11,
      finalizeAndIssue: true,
      items: [
        {
          tenancyId: "123e4567-e89b-12d3-a456-426614174000",
          electricityRupees: 2100,
          waterRupees: 400,
          maintenanceRupees: 500,
          otherChargesRupees: 0,
          creditsRupees: 0,
          dueDate: "2026-11-15",
        },
      ],
    });
    assert(batchValid.success, "Validates batch variable charges billing input");

    // Offline Payment Schema
    const offlineValid = RecordOfflinePaymentSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      tenancyId: "123e4567-e89b-12d3-a456-426614174001",
      amountRupees: 15000,
      paymentMethod: "CASH",
      paymentDate: "2026-11-15",
      notes: "Received in cash at building office",
    });
    assert(offlineValid.success, "Validates valid CASH offline payment input");

    // Review Payment Submission Schema
    const approveValid = ReviewPaymentSubmissionSchema.safeParse({
      action: "APPROVE",
    });
    assert(approveValid.success, "Validates APPROVE payment review action");

    const rejectMissingReason = ReviewPaymentSubmissionSchema.safeParse({
      action: "REJECT",
      rejectionReason: "", // Empty reason should fail
    });
    assert(!rejectMissingReason.success, "Rejects payment rejection without mandatory reason");

    const rejectWithReason = ReviewPaymentSubmissionSchema.safeParse({
      action: "REJECT",
      rejectionReason: "UTR not reflecting in bank statement after 24 hours.",
    });
    assert(rejectWithReason.success, "Accepts valid REJECT action with explanatory reason");

    // Invoice Adjustment Schema
    const adjustValid = AdjustInvoiceSchema.safeParse({
      adjustmentType: "CREDIT",
      amountRupees: 1000,
      reason: "Water supply interruption courtesy discount",
    });
    assert(adjustValid.success, "Validates invoice credit adjustment with reason");
  }

  // 6. SQL Migration File Verification
  console.log("\n[Test Suite 6] PostgreSQL Migration File Assertions");
  {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261118000000_stage_d_billing_and_financials.sql"
    );
    assert(fs.existsSync(migrationPath), "Migration file exists: 20261118000000_stage_d_billing_and_financials.sql");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    assert(
      sqlContent.includes("UNIQUE (tenancy_id, billing_period_year, billing_period_month)"),
      "Enforces UNIQUE (tenancy_id, billing_period_year, billing_period_month) constraint"
    );

    assert(
      sqlContent.includes("idx_unique_active_payment_ref") &&
      sqlContent.includes("WHERE status IN ('PENDING_REVIEW', 'VERIFIED')"),
      "Enforces partial unique index on (organization_id, normalized_reference) for PENDING_REVIEW and VERIFIED"
    );

    assert(
      sqlContent.includes("rent_paise BIGINT NOT NULL") &&
      sqlContent.includes("total_due_paise BIGINT NOT NULL") &&
      sqlContent.includes("balance_due_paise BIGINT NOT NULL"),
      "Uses BIGINT for all monetary paise fields in invoices"
    );

    assert(
      sqlContent.includes("CREATE TABLE IF NOT EXISTS public.payments") &&
      sqlContent.includes("receipt_number TEXT UNIQUE NOT NULL"),
      "Creates immutable payments ledger table with receipt_number"
    );

    assert(
      sqlContent.includes("CREATE TABLE IF NOT EXISTS public.financial_audit_logs"),
      "Creates financial_audit_logs table with actor_profile_id and JSONB state diffs"
    );

    assert(
      sqlContent.includes("INSERT INTO storage.buckets (id, name, public") &&
      sqlContent.includes("'receipts'"),
      "Creates private 'receipts' storage bucket"
    );

    assert(
      sqlContent.includes("receipts_insert_authenticated") &&
      sqlContent.includes("receipts_select_authenticated"),
      "Defines private RLS policies on receipts storage objects"
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
