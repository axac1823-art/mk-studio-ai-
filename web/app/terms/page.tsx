import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: {
    canonical: "/terms",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="text-muted-foreground">
        Renderuim&apos;s Terms of Service are being prepared and have not yet been published.
      </p>
    </main>
  );
}
