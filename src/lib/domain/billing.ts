/**
 * RentPilot — Financial Domain Engine & Invariants
 * 
 * Invariants:
 * 1. Financial values are stored and calculated strictly in integer paise (1 Rupee = 100 Paise).
 * 2. Zero floating-point arithmetic on currency values.
 * 3. Invoice formula:
 *    total_due_paise = rent_paise + electricity_paise + water_paise + 
 *                      maintenance_paise + other_charges_paise + previous_balance_paise - credits_paise
 * 4. Separate Lifecycles:
 *    - Invoices have statuses ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']
 *      plus an explicit `is_overdue` boolean.
 *    - Payment submissions have statuses ['PENDING_REVIEW', 'VERIFIED', 'REJECTED'].
 *    - Rejecting a proof recalculates balances strictly from verified ledger payments.
 * 5. Payment references normalized to uppercase alphanumeric (8–30 chars).
 */

import { rupeesToPaise, paiseToRupees } from "@/lib/domain/rent-increments";

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type PaymentMethod = "UPI" | "CASH" | "CHEQUE" | "BANK_TRANSFER" | "REVERSAL";

export interface InvoiceComponentsPaise {
  rentPaise: bigint;
  electricityPaise: bigint;
  waterPaise: bigint;
  maintenancePaise: bigint;
  otherChargesPaise: bigint;
  previousBalancePaise: bigint;
  creditsPaise: bigint;
}

/**
 * Calculates total due and remaining balance in integer paise.
 */
export function calculateInvoiceTotals(
  components: InvoiceComponentsPaise,
  amountPaidPaise: bigint = BigInt(0)
): { totalDuePaise: bigint; balanceDuePaise: bigint } {
  const charges =
    components.rentPaise +
    components.electricityPaise +
    components.waterPaise +
    components.maintenancePaise +
    components.otherChargesPaise +
    components.previousBalancePaise;

  const totalDuePaise = charges > components.creditsPaise ? charges - components.creditsPaise : BigInt(0);
  const balanceDuePaise = totalDuePaise > amountPaidPaise ? totalDuePaise - amountPaidPaise : BigInt(0);

  return { totalDuePaise, balanceDuePaise };
}

/**
 * Deterministically determines invoice status and overdue flag.
 * An invoice that is partially paid and past due retains PARTIALLY_PAID status with isOverdue = true.
 */
export function determineInvoiceStatus(
  totalDuePaise: bigint,
  amountPaidPaise: bigint,
  dueDate: string | Date,
  referenceDate: Date = new Date()
): { status: InvoiceStatus; isOverdue: boolean; balanceDuePaise: bigint } {
  const balanceDuePaise = totalDuePaise > amountPaidPaise ? totalDuePaise - amountPaidPaise : BigInt(0);

  const due = new Date(dueDate);
  // Due at 23:59:59 IST of the due date
  due.setHours(23, 59, 59, 999);
  const isPastDue = referenceDate.getTime() > due.getTime();

  if (balanceDuePaise <= BigInt(0)) {
    return { status: "PAID", isOverdue: false, balanceDuePaise: BigInt(0) };
  }

  const isOverdue = isPastDue;

  if (amountPaidPaise > BigInt(0)) {
    return {
      status: "PARTIALLY_PAID",
      isOverdue,
      balanceDuePaise,
    };
  }

  return {
    status: isPastDue ? "OVERDUE" : "ISSUED",
    isOverdue,
    balanceDuePaise,
  };
}

/**
 * Normalizes payment reference / UTR:
 * Trims, strips non-alphanumeric characters, and converts to uppercase.
 * Example: " 4312-8901-2389 " -> "431289012389"
 */
export function normalizePaymentReference(raw: string): string {
  if (!raw) return "";
  return raw.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Builds standard Indian UPI Payment Deep-Link URL.
 * Specification: upi://pay?pa={vpa}&pn={payee}&am={amount}&cu=INR&tn={note}
 */
export function buildUpiPaymentUri(params: {
  vpa: string;
  payeeName: string;
  amountPaise: bigint | number;
  transactionNote: string;
}): string {
  const rupees = paiseToRupees(params.amountPaise).toFixed(2);
  const query = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    am: rupees,
    cu: "INR",
    tn: params.transactionNote,
  });
  return `upi://pay?${query.toString()}`;
}

/**
 * Generates deterministic invoice numbering:
 * Format: INV-YYYY-MM-{UNIT}
 */
export function generateInvoiceNumber(
  year: number,
  month: number,
  unitCode: string
): string {
  const cleanCode = unitCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `INV-${year}-${String(month).padStart(2, "0")}-${cleanCode}`;
}

/**
 * Generates verified receipt numbering:
 * Format: RCP-YYYY-{SEQUENCE}
 */
export function generateReceiptNumber(year: number, sequence: number): string {
  return `RCP-${year}-${String(sequence).padStart(5, "0")}`;
}

export { rupeesToPaise, paiseToRupees };
