import { URL } from "url";

/**
 * RentPilot SSRF Outbound Protection Guard
 * Strictly restricts server-side network requests to trusted APIs and blocks private/internal IPs.
 */

const ALLOWED_DOMAIN_PATTERNS = [
  /(^|\.)googleapis\.com$/,
  /(^|\.)firebaseio\.com$/,
  /(^|\.)brevo\.com$/,
  /(^|\.)supabase\.co$/,
];

// RFC 1918, RFC 3927 (link-local/cloud metadata), Loopback, IPv6 Unique Local / Link Local
const BLOCKED_IP_REGEXES = [
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,                // Loopback (127.0.0.0/8)
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,                 // Private 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,    // Private 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/,                   // Private 192.168.0.0/16
  /^169\.254\.\d{1,3}\.\d{1,3}$/,                   // Link-local / Cloud metadata (169.254.169.254)
  /^0\.0\.0\.0$/,                                   // Wildcard
  /^::1$/,                                          // IPv6 Loopback
  /^f[cd][0-9a-f]{2}:/i,                            // IPv6 Unique Local
  /^fe80:/i,                                        // IPv6 Link-Local
];

export function isSafeOutboundUrl(urlString: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlString);

    // 1. Enforce HTTPS protocol strictly
    if (parsed.protocol !== "https:") {
      return { safe: false, reason: `Insecure protocol: ${parsed.protocol}. Only https: is permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Reject internal/loopback hostnames
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return { safe: false, reason: `Access to local/internal host '${hostname}' is prohibited.` };
    }

    // 3. Reject private/metadata IP ranges
    for (const ipRegex of BLOCKED_IP_REGEXES) {
      if (ipRegex.test(hostname)) {
        return { safe: false, reason: `Access to private/metadata IP '${hostname}' is prohibited.` };
      }
    }

    // 4. Enforce domain allowlist
    const isDomainAllowed = ALLOWED_DOMAIN_PATTERNS.some((pattern) => pattern.test(hostname));
    if (!isDomainAllowed) {
      return { safe: false, reason: `Host '${hostname}' is not in the approved outbound domain allowlist.` };
    }

    return { safe: true };
  } catch (err: unknown) {
    return { safe: false, reason: err instanceof Error ? err.message : "Invalid URL" };
  }
}

/**
 * Asserts that a target URL is safe for server-side outbound HTTP requests.
 * Throws an Error if SSRF violation or unapproved domain is detected.
 */
export function assertSafeOutboundUrl(urlString: string): URL {
  const check = isSafeOutboundUrl(urlString);
  if (!check.safe) {
    throw new Error(`SSRF Guard Violation: ${check.reason || "Destination host rejected"}`);
  }
  return new URL(urlString);
}

/**
 * Safe fetch wrapper that guards against SSRF before issuing outbound network calls.
 */
export async function safeServerFetch(urlString: string, init?: RequestInit): Promise<Response> {
  assertSafeOutboundUrl(urlString);
  return fetch(urlString, init);
}
