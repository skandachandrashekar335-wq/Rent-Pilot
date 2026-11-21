import crypto from "crypto";

/**
 * RentPilot Cryptographic Signatures & Timing-Safe Helpers
 */

/**
 * Compares two strings in constant time to prevent side-channel timing attacks.
 * Safe against timing discrepancy on different length inputs.
 */
export function timingSafeStringEqual(a?: string | null, b?: string | null): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");

  // Always run comparison on fixed-length buffers to eliminate length-leak timing variations
  if (bufA.length !== bufB.length) {
    // Run dummy timingSafeEqual to consume constant time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies an HMAC-SHA256 signature (e.g. for webhooks or cross-service signed requests).
 */
export function verifyHmacSha256Signature(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  if (!rawBody || !signatureHeader || !secret) {
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // Clean prefix like 'sha256=' if present in header
    const cleanHeaderSignature = signatureHeader.replace(/^sha256=/i, "").trim();

    return timingSafeStringEqual(computedSignature, cleanHeaderSignature);
  } catch {
    return false;
  }
}
