import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/auth/server-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { BillingBatchSchema } from "@/lib/validation/billing";
import {
  calculateInvoiceTotals,
  generateInvoiceNumber,
  rupeesToPaise,
  paiseToRupees,
} from "@/lib/domain/billing";
import { sendInvoiceIssuedNotification } from "@/lib/notifications/brevo";

interface TenancyWithUnitAndTenant {
  id: string;
  monthly_rent_paise: number;
  start_date: string;
  end_date: string;
  status: string;
  tenant: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  unit: {
    id: string;
    unit_number: string;
    configuration_label: string | null;
    floor_number: number | null;
    property: { id: string; name: string } | null;
  } | null;
}

interface SingleTenancyResult {
  id: string;
  monthly_rent_paise: number;
  tenant: { id: string; full_name: string; email: string | null } | null;
  unit: { unit_number: string; property: { name: string } | null } | null;
}

export async function GET(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();
    const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

    const supabase = createAdminSupabaseClient();

    // 1. Fetch all active tenancies with unit & property info
    const { data: tenancies, error: tenanciesErr } = await supabase
      .from("tenancies")
      .select(`
        id,
        monthly_rent_paise,
        start_date,
        end_date,
        status,
        tenant:tenants(id, full_name, email, phone),
        unit:units(
          id,
          unit_number,
          configuration_label,
          floor_number,
          property:properties(id, name)
        )
      `)
      .eq("organization_id", auth.organizationId!)
      .in("status", ["ACTIVE", "UPCOMING"]);

    if (tenanciesErr) {
      return NextResponse.json({ error: tenanciesErr.message }, { status: 500 });
    }

    // 2. Fetch any existing invoices for this billing period
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("organization_id", auth.organizationId!)
      .eq("billing_period_year", year)
      .eq("billing_period_month", month);

    const invoiceMap = new Map();
    (existingInvoices || []).forEach((inv) => {
      invoiceMap.set(inv.tenancy_id, inv);
    });

    // Default due date: e.g. 15th of billing month
    const defaultDueDate = `${year}-${String(month).padStart(2, "0")}-15`;

    const typedTenancies = (tenancies || []) as unknown as TenancyWithUnitAndTenant[];
    const unitsBilling = typedTenancies.map((t) => {
      const inv = invoiceMap.get(t.id);
      return {
        tenancyId: t.id,
        unitId: t.unit?.id,
        unitCode: t.unit?.unit_number || "—",
        propertyName: t.unit?.property?.name || "—",
        tenantName: t.tenant?.full_name || "—",
        tenantEmail: t.tenant?.email || "",
        monthlyRentRupees: paiseToRupees(t.monthly_rent_paise),
        electricityRupees: inv ? paiseToRupees(inv.electricity_paise) : 0,
        waterRupees: inv ? paiseToRupees(inv.water_paise) : 0,
        maintenanceRupees: inv ? paiseToRupees(inv.maintenance_paise) : 0,
        otherChargesRupees: inv ? paiseToRupees(inv.other_charges_paise) : 0,
        creditsRupees: inv ? paiseToRupees(inv.credits_paise) : 0,
        dueDate: inv ? inv.due_date : defaultDueDate,
        invoiceId: inv?.id || null,
        invoiceNumber: inv?.invoice_number || null,
        status: inv?.status || "NOT_GENERATED",
        variableChargesConfirmed: inv?.variable_charges_confirmed || false,
      };
    });

    return NextResponse.json({
      billingYear: year,
      billingMonth: month,
      units: unitsBilling,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await verifyServerAuth(req);
    if (!auth || errorResponse) {
      return NextResponse.json({ error: errorResponse?.message || "Unauthorized" }, { status: errorResponse?.status || 401 });
    }

    const body = await req.json();
    const parsed = BillingBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const orgId = parsed.data.organizationId || auth.organizationId!;
    const supabase = createAdminSupabaseClient();

    // Ensure Billing Cycle exists
    const { data: cycle } = await supabase
      .from("billing_cycles")
      .upsert(
        {
          organization_id: orgId,
          billing_year: parsed.data.billingYear,
          billing_month: parsed.data.billingMonth,
          status: parsed.data.finalizeAndIssue ? "ISSUED" : "OPEN",
          issued_at: parsed.data.finalizeAndIssue ? new Date().toISOString() : null,
        },
        { onConflict: "organization_id,billing_year,billing_month" }
      )
      .select("id")
      .single();

    const results = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = monthNames[parsed.data.billingMonth - 1] || "Month";

    for (const item of parsed.data.items) {
      // Fetch tenancy details
      const { data: tenancy } = await supabase
        .from("tenancies")
        .select(`
          id,
          monthly_rent_paise,
          tenant:tenants(id, full_name, email),
          unit:units(unit_number, property:properties(name))
        `)
        .eq("id", item.tenancyId)
        .eq("organization_id", orgId)
        .single();

      if (!tenancy) continue;
      const typedTenancy = tenancy as unknown as SingleTenancyResult;

      const rentPaise = BigInt(typedTenancy.monthly_rent_paise);
      const electricityPaise = rupeesToPaise(item.electricityRupees);
      const waterPaise = rupeesToPaise(item.waterRupees);
      const maintenancePaise = rupeesToPaise(item.maintenanceRupees);
      const otherChargesPaise = rupeesToPaise(item.otherChargesRupees);
      const creditsPaise = rupeesToPaise(item.creditsRupees);

      const { totalDuePaise, balanceDuePaise } = calculateInvoiceTotals(
        {
          rentPaise,
          electricityPaise,
          waterPaise,
          maintenancePaise,
          otherChargesPaise,
          previousBalancePaise: BigInt(0),
          creditsPaise,
        },
        BigInt(0)
      );

      const invoiceNumber = generateInvoiceNumber(
        parsed.data.billingYear,
        parsed.data.billingMonth,
        typedTenancy.unit?.unit_number || "UNIT"
      );

      const invoiceStatus = parsed.data.finalizeAndIssue ? "ISSUED" : "DRAFT";

      // Upsert Invoice
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .upsert(
          {
            organization_id: orgId,
            billing_cycle_id: cycle?.id || null,
            tenancy_id: tenancy.id,
            invoice_number: invoiceNumber,
            billing_period_year: parsed.data.billingYear,
            billing_period_month: parsed.data.billingMonth,
            issue_date: new Date().toISOString().split("T")[0]!,
            due_date: item.dueDate,
            rent_paise: Number(rentPaise),
            electricity_paise: Number(electricityPaise),
            water_paise: Number(waterPaise),
            maintenance_paise: Number(maintenancePaise),
            other_charges_paise: Number(otherChargesPaise),
            previous_balance_paise: 0,
            credits_paise: Number(creditsPaise),
            total_due_paise: Number(totalDuePaise),
            amount_paid_paise: 0,
            balance_due_paise: Number(balanceDuePaise),
            status: invoiceStatus,
            is_overdue: false,
            variable_charges_confirmed: true,
            notes: item.notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenancy_id,billing_period_year,billing_period_month" }
        )
        .select()
        .single();

      if (invErr) {
        console.error("Invoice upsert error:", invErr);
        continue;
      }

      // Re-create invoice items
      await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);

      const lineItems = [
        { item_type: "RENT", label: "Base Monthly Rent", amount_paise: Number(rentPaise) },
      ];
      if (electricityPaise > 0) {
        lineItems.push({ item_type: "ELECTRICITY", label: "Electricity Charges", amount_paise: Number(electricityPaise) });
      }
      if (waterPaise > 0) {
        lineItems.push({ item_type: "WATER", label: "Water Charges", amount_paise: Number(waterPaise) });
      }
      if (maintenancePaise > 0) {
        lineItems.push({ item_type: "MAINTENANCE", label: "Society / Building Maintenance", amount_paise: Number(maintenancePaise) });
      }
      if (otherChargesPaise > 0) {
        lineItems.push({ item_type: "OTHER", label: "Other Miscellaneous Charges", amount_paise: Number(otherChargesPaise) });
      }
      if (creditsPaise > 0) {
        lineItems.push({ item_type: "CREDIT", label: "Landlord Credit / Rebate", amount_paise: -Number(creditsPaise) });
      }

      await supabase.from("invoice_items").insert(
        lineItems.map((li) => ({
          organization_id: orgId,
          invoice_id: invoice.id,
          ...li,
        }))
      );

      // Audit Log
      await supabase.from("financial_audit_logs").insert({
        organization_id: orgId,
        entity_type: "INVOICE",
        entity_id: invoice.id,
        action: parsed.data.finalizeAndIssue ? "INVOICE_ISSUED" : "VARIABLE_CHARGES_SAVED",
        actor_profile_id: auth.profileId,
        after_state: {
          invoice_number: invoice.invoice_number,
          total_due_paise: invoice.total_due_paise,
          status: invoice.status,
        },
      });

      // Brevo notification if finalized & issued
      if (parsed.data.finalizeAndIssue && typedTenancy.tenant?.email) {
        const host = req.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const portalUrl = `${protocol}://${host}/portal`;

        sendInvoiceIssuedNotification({
          tenantEmail: typedTenancy.tenant.email,
          tenantName: typedTenancy.tenant.full_name || "Tenant",
          propertyName: typedTenancy.unit?.property?.name || "Rental Property",
          unitCode: typedTenancy.unit?.unit_number || "Unit",
          invoiceNumber: invoice.invoice_number,
          billingMonthName: monthName,
          billingYear: parsed.data.billingYear,
          totalDueRupees: paiseToRupees(invoice.total_due_paise),
          dueDate: invoice.due_date,
          portalUrl,
        }).catch((err) => console.error("Brevo notification warning:", err));
      }

      results.push(invoice);
    }

    return NextResponse.json({
      success: true,
      message: parsed.data.finalizeAndIssue
        ? `Successfully issued ${results.length} invoices.`
        : `Saved variable charges for ${results.length} units in draft.`,
      invoices: results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
