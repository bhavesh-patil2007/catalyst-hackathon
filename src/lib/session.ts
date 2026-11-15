import { getIronSession, SessionOptions, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { UserRole } from "@/types";

export interface SessionData {
  authenticated: boolean;
  role: UserRole;
  profileId: string;
  memberName: string;
}

/**
 * Validates and retrieves the session secret.
 * Enforces strict 32+ character requirement in production with zero hardcoded fallback.
 */
export function getSessionSecret(): string {
  const secret = process.env.IRON_SESSION_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "FATAL: IRON_SESSION_SECRET environment variable is missing or less than 32 characters in production. Application startup aborted."
      );
    }
    if (secret === "guardian-oasis-dev-secret-change-in-production-32") {
      throw new Error(
        "FATAL: Insecure development fallback IRON_SESSION_SECRET is forbidden in production."
      );
    }
    return secret;
  }

  // Development/Test fallback
  return secret && secret.length >= 32
    ? secret
    : "guardian-oasis-dev-secret-change-in-production-32";
}

export const sessionOptions: SessionOptions = {
  get password() {
    return getSessionSecret();
  },
  cookieName: "guardian_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    return session;
  } catch {
    // Outside Next.js request context (e.g. unit test runner without server context)
    return {
      authenticated: false,
      role: undefined as any,
      profileId: undefined as any,
      memberName: undefined as any,
      save: async () => {},
      destroy: () => {},
    } as IronSession<SessionData>;
  }
}
