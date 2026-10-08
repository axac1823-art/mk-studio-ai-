import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getSiteUrl } from "@/lib/site-url";
import { CanonicalHostRedirect } from "@/components/auth/canonical-host-redirect";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Renderuim | AI Architectural Rendering",
    template: "%s | Renderuim",
  },
  description:
    "Create architectural renders, mood variations, alternate views, and presentation videos from your design workflow with Renderuim.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Renderuim",
    title: "Renderuim | AI Architectural Rendering",
    description:
      "Create architectural renders, mood variations, alternate views, and presentation videos from your design workflow.",
    url: "/",
    images: [
      {
        url: "/hero.webp",
        alt: "Architectural visualization created with Renderuim",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Renderuim | AI Architectural Rendering",
    description:
      "Create architectural renders, mood variations, alternate views, and presentation videos with Renderuim.",
    images: ["/hero.webp"],
  },
};

const themeInitScript = `
  (function() {
    let theme = "dark";
    try {
      theme = localStorage.getItem("renderuim-theme") === "light" ? "light" : "dark";
    } catch {}
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    var desktop = window.matchMedia("(min-width: 768px)").matches;
    var heroImage = desktop
      ? (theme === "dark" ? "/hero.webp" : "/hero_white.webp")
      : (theme === "dark" ? "/mobile_hero.webp" : "/mobile_lightmod.webp");
    var preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = heroImage;
    preload.setAttribute("fetchpriority", "high");
    document.head.appendChild(preload);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CanonicalHostRedirect siteOrigin={getSiteUrl().origin} />
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
