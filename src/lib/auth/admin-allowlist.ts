export const OWNER_ADMIN_EMAILS = [
  "skandachandrashekar335@gmail.com",
  "chandraskekar335@gmail.com",
] as const;

export function isAllowedOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return OWNER_ADMIN_EMAILS.includes(
    email.trim().toLowerCase() as (typeof OWNER_ADMIN_EMAILS)[number]
  );
}
