/**
 * RentPilot Safe Logging Utility
 * Automatically redacts bearer tokens, JWTs, private keys, API secrets, and masks emails.
 */

const BEARER_REGEX = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_REGEX = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]*/gi;
const PRIVATE_KEY_REGEX = /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/gi;
const SENSITIVE_KV_REGEX = /(apiKey|api_key|service_role_key|privateKey|private_key|cronSecret|cron_secret|secret|password|token)\s*[:=]\s*["']?([^"'\s,]+)["']?/gi;
const EMAIL_REGEX = /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g;

export function redactSensitiveData(input: unknown): string {
  if (input === null || input === undefined) {
    return "";
  }

  let text: string;
  if (typeof input === "string") {
    text = input;
  } else if (input instanceof Error) {
    text = `${input.name}: ${input.message}\n${input.stack || ""}`;
  } else {
    try {
      text = JSON.stringify(input);
    } catch {
      text = String(input);
    }
  }

  return text
    .replace(PRIVATE_KEY_REGEX, "[REDACTED_PRIVATE_KEY]")
    .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
    .replace(JWT_REGEX, "[REDACTED_JWT]")
    .replace(SENSITIVE_KV_REGEX, '$1="[REDACTED]"')
    .replace(EMAIL_REGEX, "$1***@$2");
}

export function safeLog(...args: unknown[]): void {
  const sanitized = args.map((arg) => redactSensitiveData(arg));
  console.log(...sanitized);
}

export function safeWarn(...args: unknown[]): void {
  const sanitized = args.map((arg) => redactSensitiveData(arg));
  console.warn(...sanitized);
}

export function safeError(...args: unknown[]): void {
  const sanitized = args.map((arg) => redactSensitiveData(arg));
  console.error(...sanitized);
}
