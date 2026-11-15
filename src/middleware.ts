import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/caregiver",
  "/medications",
  "/appointments",
  "/timeline",
  "/elder",
  "/wellbeing",
  "/medsutra",
];

const PUBLIC_EXACT_PATHS = ["/", "/login"];
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/api/care/today",
  "/api/care/escalate-demo",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and favicon pass through
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Allow public landing, login, health and explicitly public APIs
  if (
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // Check if accessing a protected page or any non-public route
  const sessionCookie = request.cookies.get("guardian_session");
  if (!sessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
