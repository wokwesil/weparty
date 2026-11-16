/**
 * Public contact details shown on /support, /privacy and in the apps.
 * Set NEXT_PUBLIC_SUPPORT_EMAIL in Vercel (Settings > Environment Variables).
 * The App Store and Google Play both require a working support contact.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
export const APP_NAME = "We Party";
export const POLICY_UPDATED = "November 16, 2026";

export function supportMailto(subject: string, body = "") {
  if (!SUPPORT_EMAIL) return null;
  const q = new URLSearchParams({ subject, ...(body ? { body } : {}) }).toString().replace(/\+/g, "%20");
  return `mailto:${SUPPORT_EMAIL}?${q}`;
}
