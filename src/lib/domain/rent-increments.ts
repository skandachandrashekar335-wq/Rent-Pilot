/**
 * RentPilot — Rent Increment Domain Logic & Currency Mathematics
 * 
 * Invariants:
 * 1. Financial values are stored and calculated strictly in integer paise (1 Rupee = 100 Paise).
 * 2. Floating-point drift is strictly avoided by rounding intermediate percentage steps deterministically.
 * 3. Historical rent records are never overwritten when new rent increments are applied.
 */

export type IncrementType = "PERCENTAGE" | "FIXED_AMOUNT";

/**
 * Converts integer paise to decimal rupees for display.
 */
export function paiseToRupees(paise: bigint | number): number {
  return Number(paise) / 100;
}

/**
 * Converts decimal rupees input into integer paise.
 */
export function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * 100));
}

/**
 * Calculates the next rent amount in integer paise.
 * 
 * @param currentRentPaise Current monthly rent in paise.
 * @param incrementType 'PERCENTAGE' (e.g. 10 for 10%) or 'FIXED_AMOUNT' (rupees or paise).
 * @param incrementValue Percentage rate (e.g., 5.0 for 5%) or fixed rupees (e.g., 1000 for ₹1000).
 * @returns Next rent in integer paise.
 */
export function calculateNextRentPaise(
  currentRentPaise: bigint,
  incrementType: IncrementType,
  incrementValue: number
): bigint {
  if (incrementValue <= 0) {
    return currentRentPaise;
  }

  if (incrementType === "FIXED_AMOUNT") {
    const fixedIncreasePaise = rupeesToPaise(incrementValue);
    return currentRentPaise + fixedIncreasePaise;
  }

  // PERCENTAGE calculation:
  // (currentRentPaise * (10000 + incrementValue * 100)) / 10000 with deterministic Math.round
  // Example: 600000 paise * 10% = 60000 paise increase -> 660000 paise
  const rentNumber = Number(currentRentPaise);
  const increasePaise = Math.round((rentNumber * incrementValue) / 100);
  return currentRentPaise + BigInt(increasePaise);
}

/**
 * Calculates a multi-year compounded rent projection series in integer paise.
 * 
 * Verifies exact compounding:
 * Year 1: ₹6,000 (600,000 paise)
 * Year 2: ₹6,600 (660,000 paise)
 * Year 3: ₹7,260 (726,000 paise)
 * Year 4: ₹7,986 (798,600 paise)
 */
export function calculateCompoundedRentSeries(
  startRentPaise: bigint,
  annualPercentage: number,
  years: number
): bigint[] {
  const series: bigint[] = [startRentPaise];
  let current = startRentPaise;

  for (let i = 1; i < years; i++) {
    current = calculateNextRentPaise(current, "PERCENTAGE", annualPercentage);
    series.push(current);
  }

  return series;
}

/**
 * Checks if a scheduled rent increment is due or upcoming within a notice window (default 30 days).
 */
export function isIncrementUpcoming(
  nextIncrementDate: string | Date,
  noticeWindowDays: number = 30,
  referenceDate: Date = new Date()
): { isDue: boolean; isUpcoming: boolean; daysRemaining: number } {
  const targetDate = new Date(nextIncrementDate);
  const diffTime = targetDate.getTime() - referenceDate.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isDue = daysRemaining <= 0;
  const isUpcoming = daysRemaining > 0 && daysRemaining <= noticeWindowDays;

  return { isDue, isUpcoming, daysRemaining };
}

/**
 * Calculates the next increment date given the current effective date and interval in months.
 */
export function computeNextIncrementDate(
  effectiveDate: string | Date,
  intervalMonths: number = 12
): string {
  const date = new Date(effectiveDate);
  date.setMonth(date.getMonth() + intervalMonths);
  return date.toISOString().split("T")[0]!;
}
