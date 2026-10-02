import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    { url: new URL("/", siteUrl).toString() },
    { url: new URL("/pricing", siteUrl).toString() },
  ];
}
