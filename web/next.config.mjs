import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig | ((phase: string) => import('next').NextConfig)} */
const nextConfig = (phase) => ({
  // Keep dev output separate from builds and from the legacy tracked .next-dev cache.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev-local" : ".next",
});

export default nextConfig;
