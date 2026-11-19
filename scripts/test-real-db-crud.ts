import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
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

// Enable local bypass for automated script execution
process.env.ALLOW_DEV_AUTH_BYPASS = "true";
(process.env as Record<string, string>).NODE_ENV = "development";

const baseUrl = process.env.TEST_APP_URL || "http://localhost:3008";
const authHeader = { Authorization: "Bearer dev-test-token" };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pnbtexouxvlurtvphzpz.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

let total = 0;
let passed = 0;

function assert(condition: boolean, desc: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${desc}`);
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    process.exitCode = 1;
  }
}

async function runRealDbCrudTest() {
  console.log("==========================================================");
  console.log("RentPilot — End-to-End Real Database CRUD Verification");
  console.log("Database:", supabaseUrl);
  console.log("Server:", baseUrl);
  console.log("==========================================================");

  let orgId: string | null = null;
  let propertyId: string | null = null;
  let unitId: string | null = null;
  let tenancyId: string | null = null;
  let invoiceId: string | null = null;
  const testUnitCode = `U-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    // 1. GET /api/auth/sync
    console.log("\n[Step 1] GET /api/auth/sync (Auto-provision Profile & Org)");
    const syncRes = await fetch(`${baseUrl}/api/auth/sync`, {
      method: "GET",
      headers: authHeader,
    });
    const syncData = await syncRes.json();
    assert(syncRes.ok, `GET /api/auth/sync returned 200 OK (${syncRes.status})`);
    assert(Boolean(syncData.profile?.id), "User profile auto-provisioned in Supabase");
    assert(Boolean(syncData.isOwner), "User granted OWNER status");
    assert(syncData.memberships?.length > 0, "Organization membership established");

    orgId = syncData.memberships[0]?.organization_id;
    assert(Boolean(orgId), `Active Organization ID: ${orgId}`);

    // Verify directly in Supabase table
    const { data: dbOrg } = await supabase.from("organizations").select("id, name").eq("id", orgId!).single();
    assert(dbOrg?.id === orgId, "Organization physically verified in Supabase PostgreSQL");

    // 2. POST /api/properties
    console.log("\n[Step 2] POST /api/properties (Insert Real Property)");
    const propRes = await fetch(`${baseUrl}/api/properties`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        name: "Test E2E Residence " + Date.now(),
        propertyType: "INDEPENDENT_HOUSE",
        addressLine: "123 Test Residency, MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        totalFloors: 3,
        facilities: ["Borewell Water", "Security Guard", "CCTV"],
      }),
    });
    const propData = await propRes.json();
    assert(propRes.ok, `POST /api/properties returned 201 Created (${propRes.status})`);
    propertyId = propData.property?.id;
    assert(Boolean(propertyId), `Real Property inserted with ID: ${propertyId}`);

    // Verify in Supabase table
    const { data: dbProp } = await supabase.from("properties").select("id, name").eq("id", propertyId!).single();
    assert(dbProp?.id === propertyId, "Property physically verified in Supabase PostgreSQL");

    // 3. POST /api/units
    console.log("\n[Step 3] POST /api/units (Insert Real Unit)");
    const unitRes = await fetch(`${baseUrl}/api/units`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        propertyId: propertyId,
        unitNumber: testUnitCode,
        floorNumber: 1,
        configurationLabel: "2 BHK",
        bedrooms: 2,
        bathrooms: 2,
        hasParking: true,
        facilities: ["Balcony"],
        baseRentRupees: 25000,
        securityDepositRupees: 100000,
        occupancyStatus: "VACANT",
      }),
    });
    const unitData = await unitRes.json();
    assert(unitRes.ok, `POST /api/units returned 201 Created (${unitRes.status})`);
    unitId = unitData.unit?.id;
    assert(Boolean(unitId), `Real Unit inserted with ID: ${unitId}`);

    // Verify in Supabase table
    const { data: dbUnit } = await supabase.from("units").select("id, base_rent_paise").eq("id", unitId!).single();
    assert(dbUnit?.base_rent_paise === 2500000, "Unit rent correctly stored as 25,00,000 paise in Supabase");

    // 4. POST /api/tenancies
    console.log("\n[Step 4] POST /api/tenancies (Insert Real Tenancy)");
    const tenancyRes = await fetch(`${baseUrl}/api/tenancies`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        unitId: unitId,
        tenantEmail: `tenant.${Date.now()}@example.com`,
        tenantFullName: "Test Tenant Real",
        tenantPhone: "+91 99887 76655",
        startDate: "2026-11-01",
        monthlyRentRupees: 25000,
        securityDepositRupees: 100000,
        status: "ACTIVE",
      }),
    });
    const tenancyData = await tenancyRes.json();
    assert(tenancyRes.ok, `POST /api/tenancies returned 201 Created (${tenancyRes.status})`);
    tenancyId = tenancyData.tenancy?.id;
    assert(Boolean(tenancyId), `Real Tenancy inserted with ID: ${tenancyId}`);

    // Verify unit status updated to OCCUPIED
    const { data: unitOcc } = await supabase.from("units").select("occupancy_status").eq("id", unitId!).single();
    assert(unitOcc?.occupancy_status === "OCCUPIED", "Unit status automatically transitioned to OCCUPIED in Supabase");

    // 5. POST /api/billing/batch
    console.log("\n[Step 5] POST /api/billing/batch (Generate Real Invoice)");
    const batchRes = await fetch(`${baseUrl}/api/billing/batch`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 11,
        finalizeAndIssue: true,
        items: [
          {
            tenancyId: tenancyId,
            electricityRupees: 2200,
            waterRupees: 350,
            maintenanceRupees: 500,
            otherChargesRupees: 0,
            creditsRupees: 0,
            dueDate: "2026-11-15",
          },
        ],
      }),
    });
    const batchData = await batchRes.json();
    assert(batchRes.ok, `POST /api/billing/batch returned 200 OK (${batchRes.status})`);
    assert(Boolean(batchData.invoices && batchData.invoices.length === 1), "Exactly 1 real invoice created");

    // Query the generated invoice
    const { data: dbInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_due_paise, status")
      .eq("tenancy_id", tenancyId!)
      .order("created_at", { ascending: false });

    assert(Boolean(dbInvoices && dbInvoices.length > 0), "Invoice physically retrieved from Supabase invoices table");
    invoiceId = dbInvoices![0].id;
    assert(dbInvoices![0].status === "ISSUED", `Invoice initial status is ISSUED (${dbInvoices![0].status})`);
    assert(dbInvoices![0].total_due_paise === (25000 + 2200 + 350 + 500) * 100, "Invoice total_due_paise correctly calculated in Supabase");

    // 6. POST /api/payments/offline
    console.log("\n[Step 6] POST /api/payments/offline (Record Real Payment & Reconcile)");
    const totalRupees = (25000 + 2200 + 350 + 500);
    const payRes = await fetch(`${baseUrl}/api/payments/offline`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        invoiceId: invoiceId,
        amountRupees: totalRupees,
        paymentMethod: "BANK_TRANSFER",
        paymentDate: "2026-11-10",
        referenceNumber: "IMPS8912389102",
        notes: "Direct bank settlement verified",
      }),
    });
    const payData = await payRes.json();
    assert(payRes.ok, `POST /api/payments/offline returned 201 Created (${payRes.status})`);
    assert(Boolean(payData.payment?.receipt_number), `Real Receipt Number generated: ${payData.payment?.receipt_number}`);

    // Verify invoice status updated to PAID in Supabase
    const { data: paidInv } = await supabase.from("invoices").select("status, balance_due_paise").eq("id", invoiceId!).single();
    assert(paidInv?.status === "PAID", `Invoice status updated to PAID in Supabase (${paidInv?.status})`);
    assert(paidInv?.balance_due_paise === 0, `Invoice balance due reconciled to 0 paise (${paidInv?.balance_due_paise})`);

    // 7. PATCH /api/tenancies/[id]
    console.log("\n[Step 7] PATCH /api/tenancies/[id] (Conclude Tenancy Cleanly)");
    const endRes = await fetch(`${baseUrl}/api/tenancies/${tenancyId}`, {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        endDate: "2026-11-19",
        status: "COMPLETED",
        terminationReason: "Verification lease completed cleanly",
      }),
    });
    const endData = await endRes.json();
    assert(endRes.ok, `PATCH /api/tenancies/[id] returned 200 OK (${endRes.status})`);
    assert(endData.tenancy?.status === "COMPLETED", "Tenancy status updated to COMPLETED");

    // Verify unit status returned to VACANT in Supabase
    const { data: unitVac } = await supabase.from("units").select("occupancy_status").eq("id", unitId!).single();
    assert(unitVac?.occupancy_status === "VACANT", "Unit status automatically transitioned back to VACANT in Supabase");

  } finally {
    // 8. Clean up all created test records
    console.log("\n[Step 8] Database Hygiene Cleanup (Purging Test Data)");
    if (invoiceId) {
      await supabase.from("payments").delete().eq("invoice_id", invoiceId);
      await supabase.from("payment_submissions").delete().eq("invoice_id", invoiceId);
      await supabase.from("invoices").delete().eq("id", invoiceId);
      console.log("  ✓ Deleted test invoices & payments");
    }
    if (tenancyId) {
      await supabase.from("rent_increment_schedules").delete().eq("tenancy_id", tenancyId);
      await supabase.from("tenancies").delete().eq("id", tenancyId);
      console.log("  ✓ Deleted test tenancy & increment schedules");
    }
    if (unitId) {
      await supabase.from("units").delete().eq("id", unitId);
      console.log("  ✓ Deleted test unit");
    }
    if (propertyId) {
      await supabase.from("properties").delete().eq("id", propertyId);
      console.log("  ✓ Deleted test property");
    }

    console.log("\n==========================================================");
    console.log(`CRUD Test Results: ${passed}/${total} Passed (${total - passed} Failed)`);
    console.log("==========================================================");
  }
}

runRealDbCrudTest().catch(console.error);
