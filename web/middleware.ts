import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/api/stripe/webhooks",
  "/api/config/costs",
  "/api/models",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSupabaseConfig =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Mode dev local sans projet Supabase : on laisse passer et on confie le
  // fallback utilisateur aux helpers côté route (AUTH_DEBUG).
  if (!hasSupabaseConfig && process.env.AUTH_DEBUG === "true") {
    return NextResponse.next();
  }

  if (!hasSupabaseConfig) {
    return new NextResponse(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local, or enable AUTH_DEBUG=true for local development.",
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Refresh session cookies on every request.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && pathname.startsWith("/app")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo") ?? "/";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup", "/api/:path*"],
};
