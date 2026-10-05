/**
 * Canonical public site URL.
 *
 * In production this must be an HTTPS public URL. In local development,
 * use the actual local origin instead of a hard-coded LAN address.
 */
export function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : null);

  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url;
      }
    } catch {
      // Fall through to localhost for local development.
    }
  }

  return new URL("http://localhost:3000/");
}
