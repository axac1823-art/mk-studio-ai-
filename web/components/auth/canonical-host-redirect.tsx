"use client";

import { useEffect } from "react";

const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

/** Keep browser auth cookies on the configured LAN/public origin. */
export function CanonicalHostRedirect({
  siteOrigin,
}: {
  siteOrigin: string;
}) {
  useEffect(() => {
    const current = new URL(window.location.href);
    if (!LOOPBACK_HOSTS.has(current.hostname.toLowerCase())) return;

    const canonical = new URL(siteOrigin);
    if (current.origin === canonical.origin) return;

    current.protocol = canonical.protocol;
    current.host = canonical.host;
    window.location.replace(current.toString());
  }, [siteOrigin]);

  return null;
}
