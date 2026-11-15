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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (
    pathname === "/" ||
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
    const url = new URL("/", request.url);
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
