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

const PUBLIC_API_PREFIXES = ["/api/auth", "/api/health"];

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

  // Allow public landing and public API endpoints
  if (
    pathname === "/" ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // Check if accessing a protected page
  const isProtectedPage = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const sessionCookie = request.cookies.get("guardian_session");

  if (isProtectedPage && !sessionCookie) {
    const url = new URL("/", request.url);
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
