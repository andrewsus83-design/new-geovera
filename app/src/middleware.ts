import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ══════════════════════════════════════════════════════════════════════════
   GeoVera Middleware — Workflow Gate
   Step 3 → Step 4: after login, check subscription
   Unauthenticated users → /onboarding
══════════════════════════════════════════════════════════════════════════ */

// Routes that don't require authentication
const PUBLIC_PREFIXES = [
  "/onboarding",
  "/signin",
  "/signup",
  "/reset-password",
  "/two-step-verification",
  "/oauth-done",
  "/auth/callback",
  "/payment",
  "/report",
  "/rss",
  "/articles",
  "/api",
  "/_next",
  "/favicon",
  "/images",
  "/icons",
];

// Supabase auth cookie name (based on project ref)
const SUPABASE_COOKIE = "sb-vozjwptzutolvkvfpknk-auth-token";

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  // AUTH DISABLED FOR PRESENTATION — re-enable after demo
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static assets and api routes
     * that don't need auth (handled above in PUBLIC_PREFIXES)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)).*)",
  ],
};
