import { NextResponse } from "next/server";
import { INITIAL_PROFILE } from "@/lib/store";
import { getSession } from "@/lib/session";
import { isDemoCredential, verifyCircleInvitation } from "@/lib/authCrypto";
import { UserRole } from "@/types";

// In-memory IP rate limiter: 5 attempts per minute
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

function getRoleRedirect(role: UserRole): string {
  switch (role) {
    case "owner":
      return "/elder";
    case "caregiver":
      return "/caregiver";
    case "family_manager":
      return "/dashboard";
    case "read_only":
      return "/timeline";
    default:
      return "/dashboard";
  }
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
        { success: false, error: "Circle invite code is required" },
        { status: 400 }
      );
    }

    // In production, reject known demo codes
    if (process.env.NODE_ENV === "production" && isDemoCredential(code)) {
      return NextResponse.json(
        {
          success: false,
          error: "Demo invite codes are strictly prohibited in production.",
        },
        { status: 401 }
      );
    }

    // Verify invite code and derive server-determined role
    const verification = verifyCircleInvitation(code);

    if (!verification.valid || !verification.role) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired circle invitation code." },
        { status: 401 }
      );
    }

    const assignedRole = verification.role;
    const defaultName =
      assignedRole === "caregiver"
        ? "Primary Caregiver"
        : assignedRole === "read_only"
        ? "Care Circle Observer"
        : "Care Circle Member";

    const memberName = name?.trim() || defaultName;

    const session = await getSession();
    session.authenticated = true;
    session.role = assignedRole;
    session.profileId = INITIAL_PROFILE.id;
    session.memberName = memberName;
    await session.save();

    return NextResponse.json({
      success: true,
      role: assignedRole,
      memberName,
      invitationLabel: verification.label,
      redirectUrl: getRoleRedirect(assignedRole),
      email: email?.trim() || undefined,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
