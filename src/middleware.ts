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
const AUTH_API = "/api/auth";
const PUBLIC_API = ["/api/care/today", "/api/care/escalate-demo"];
const PUBLIC_EXACT_PATHS = ["/", "/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public landing, login and explicitly public API paths.
  if (
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    pathname.startsWith(AUTH_API) ||
    PUBLIC_API.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Check if protected
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check session cookie exists (iron-session uses a signed cookie)
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
