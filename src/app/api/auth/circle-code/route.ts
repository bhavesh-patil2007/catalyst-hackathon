import { NextResponse } from "next/server";
import { INITIAL_PROFILE } from "@/lib/store";
import { getSession } from "@/lib/session";

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `circle-code:${ip}`;
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Try again in a minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { code, name, email } = body as {
      code?: string;
      name?: string;
      email?: string;
    };

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "Circle code is required" },
        { status: 400 }
      );
    }

    if (code.trim().toUpperCase() !== INITIAL_PROFILE.circleInviteCode.toUpperCase()) {
      return NextResponse.json(
        { success: false, error: "Invalid circle code" },
        { status: 401 }
      );
    }

    const session = await getSession();
    session.authenticated = true;
    session.role = "family_manager";
    session.profileId = INITIAL_PROFILE.id;
    session.memberName = name ?? "Care Circle Member";
    await session.save();

    return NextResponse.json({
      success: true,
      role: "family_manager",
      memberName: name ?? "Care Circle Member",
      email: email ?? undefined,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
