import { NextResponse } from "next/server";
import { INITIAL_PROFILE } from "@/lib/store";
import { getSession } from "@/lib/session";

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `elder-pin:${ip}`;
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
    const { pin } = body as { pin?: string };

    if (!pin || typeof pin !== "string") {
      return NextResponse.json(
        { success: false, error: "PIN is required" },
        { status: 400 }
      );
    }

    if (pin !== INITIAL_PROFILE.passcode) {
      return NextResponse.json(
        { success: false, error: "Incorrect PIN" },
        { status: 401 }
      );
    }

    const session = await getSession();
    session.authenticated = true;
    session.role = "owner";
    session.profileId = INITIAL_PROFILE.id;
    session.memberName = INITIAL_PROFILE.displayName;
    await session.save();

    return NextResponse.json({
      success: true,
      role: "owner",
      memberName: INITIAL_PROFILE.displayName,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
