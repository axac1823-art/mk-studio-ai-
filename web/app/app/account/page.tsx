import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountPage() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Your profile and subscription details.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>Account management will be available once Supabase auth is integrated.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page is a placeholder for the upcoming account panel.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
