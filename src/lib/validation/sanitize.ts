/**
 * RentPilot Input Sanitization & Injection Hardening Library
 * Strictly strips dangerous control characters, HTML tags, and SQL injection payloads.
 */

const DANGEROUS_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_REGEX = /<\/?[^>]+(>|$)/gi;
const SQL_INJECTION_TOKENS = /(--|\/\*|\*\/|;|\b(UNION\s+SELECT|DROP\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|SELECT\s+.*\s+FROM)\b)/gi;

/**
 * Sanitizes generic user text:
 * 1. Strips non-printable control characters
 * 2. Strips HTML/Script tags to prevent stored XSS
 * 3. Trims whitespace
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .replace(DANGEROUS_CONTROL_CHARS, "")
    .replace(HTML_TAG_REGEX, "")
    .trim();
}

/**
 * Validates search/filter query parameters against raw SQL injection payloads.
 * Returns true if clean, false if potential SQL injection is detected.
 */
export function isSafeSearchParam(input?: string | null): boolean {
  if (!input) return true;
  if (DANGEROUS_CONTROL_CHARS.test(input)) return false;
  if (SQL_INJECTION_TOKENS.test(input)) return false;
  return true;
}

/**
 * Asserts that a parameter contains zero SQL injection payloads, throwing an Error otherwise.
 */
export function assertSafeQueryParam(paramName: string, value?: string | null): void {
  if (!value) return;
  if (!isSafeSearchParam(value)) {
    throw new Error(`Invalid or dangerous characters detected in query parameter: '${paramName}'`);
  }
}
