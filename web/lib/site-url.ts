/**
 * Canonical public site URL.
 *
 * In production this must be an HTTPS public URL. Local development can use
 * localhost, but internal/invalid hosts such as 0.0.0.0 must never become a
 * public redirect target.
 */
export function getSiteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean) as string[];

  for (const configuredUrl of candidates) {
    try {
      const url = new URL(configuredUrl);
      const invalidHost = ["0.0.0.0", "::", "localhost", "127.0.0.1", "::1"].includes(
        url.hostname
      );

      if (!invalidHost && (url.protocol === "http:" || url.protocol === "https:")) {
        return url;
      }
    } catch {
      // Try the next configured URL.
    }
  }

  return new URL("http://localhost:3000/");
}
