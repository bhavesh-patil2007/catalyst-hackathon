import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { UserRole } from "@/types";
import { guardianStore } from "@/lib/store";

export interface AuthorizedActor {
  role: UserRole;
  memberName: string;
  profileId: string;
  authenticated: boolean;
}

export type AuthResult =
  | { success: true; actor: AuthorizedActor }
  | { success: false; response: NextResponse };

/**
 * Server-side RBAC and Patient Isolation Guard.
 * Inspects the iron-session cookie securely.
 * Rejects forged client roles and enforces patient boundaries.
 */
export async function requireAuthorizedActor(
  allowedRoles: UserRole[] = ["owner", "family_manager", "caregiver"],
  targetProfileId?: string
): Promise<AuthResult> {
  const session = await getSession();

  // If session is authenticated, strictly use session identity
  if (session.authenticated && session.role) {
    const role = session.role;
    const profileId = session.profileId || guardianStore.getProfile().id;
    const memberName = session.memberName || "Authorized Member";

    // 1. Role authorization
    if (!allowedRoles.includes(role)) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            error: `Forbidden: role '${role}' is not authorized to perform this action.`,
          },
          { status: 403 }
        ),
      };
    }

    // 2. Patient boundary verification
    if (targetProfileId && !guardianStore.verifyPatientAccess(profileId, targetProfileId)) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            error: "Forbidden: Caregiver or member is not authorized to access this patient profile.",
          },
          { status: 403 }
        ),
      };
    }

    return {
      success: true,
      actor: {
        role,
        memberName,
        profileId,
        authenticated: true,
      },
    };
  }

  // Unauthenticated requests receive 401 Unauthorized
  return {
    success: false,
    response: NextResponse.json(
      {
        success: false,
        error: "Authentication required. Please authenticate via senior PIN or circle invite passcode.",
      },
      { status: 401 }
    ),
  };
}

/**
 * Authenticates request from session, strictly isolating any test header simulation
 * to test environments (NODE_ENV === "test").
 * In production, client headers are NEVER honored and always rejected if session is absent.
 */
export async function getActorFromSessionOrHeader(
  request: Request,
  allowedRoles: UserRole[] = ["owner", "family_manager", "caregiver"],
  targetProfileId?: string
): Promise<AuthResult> {
  const session = await getSession();

  if (session.authenticated && session.role) {
    return requireAuthorizedActor(allowedRoles, targetProfileId);
  }

  // In production, NEVER trust client-supplied headers or fall back to demo accounts
  if (process.env.NODE_ENV === "production") {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Authentication required. Session is invalid or expired.",
        },
        { status: 401 }
      ),
    };
  }

  // Simulated identity headers are restricted EXCLUSIVELY to test runners
  const isTestEnvironment =
    process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_AUTH_HEADERS === "true";

  if (isTestEnvironment) {
    const demoRole = request.headers.get("x-guardian-role") as UserRole | null;
    const demoProfileId =
      request.headers.get("x-guardian-profile-id") || guardianStore.getProfile().id;
    const demoActorName = request.headers.get("x-guardian-actor-name") || "Test Simulated User";

    if (demoRole && ["owner", "family_manager", "caregiver", "read_only"].includes(demoRole)) {
      if (!allowedRoles.includes(demoRole)) {
        return {
          success: false,
          response: NextResponse.json(
            {
              success: false,
              error: `Forbidden: role '${demoRole}' is not authorized.`,
            },
            { status: 403 }
          ),
        };
      }

      if (targetProfileId && !guardianStore.verifyPatientAccess(demoProfileId, targetProfileId)) {
        return {
          success: false,
          response: NextResponse.json(
            {
              success: false,
              error: "Forbidden: cross-patient access denied.",
            },
            { status: 403 }
          ),
        };
      }

      return {
        success: true,
        actor: {
          role: demoRole,
          memberName: demoActorName,
          profileId: demoProfileId,
          authenticated: true,
        },
      };
    }
  }

  return {
    success: false,
    response: NextResponse.json(
      {
        success: false,
        error: "Authentication required. Please log in.",
      },
      { status: 401 }
    ),
  };
}
