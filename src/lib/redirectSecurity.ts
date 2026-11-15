import { UserRole } from "@/types";

export const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  owner: ["/elder", "/timeline"],
  caregiver: [
    "/caregiver",
    "/medications",
    "/appointments",
    "/timeline",
    "/wellbeing",
    "/medsutra",
  ],
  family_manager: [
    "/dashboard",
    "/caregiver",
    "/medications",
    "/appointments",
    "/timeline",
    "/wellbeing",
    "/medsutra",
  ],
  read_only: ["/timeline", "/dashboard"],
};

export const ROLE_DEFAULT_REDIRECT: Record<UserRole, string> = {
  owner: "/elder",
  caregiver: "/caregiver",
  family_manager: "/dashboard",
  read_only: "/timeline",
};

/**
 * Validates and sanitizes redirect destinations against open-redirect and role tampering attacks.
 * - Rejects absolute URLs (http://, https://, javascript:, data:)
 * - Rejects protocol-relative URLs (//example.com)
 * - Rejects backslash bypasses (/\example.com, \example.com)
 * - Restricts navigation strictly to paths authorized for the authenticated role
 * - Falls back to role default destination on any mismatch or invalid path
 */
export function sanitizeRedirectUrl(
  redirectParam: string | null | undefined,
  role: UserRole
): string {
  const fallback = ROLE_DEFAULT_REDIRECT[role] || "/dashboard";

  if (!redirectParam || typeof redirectParam !== "string") {
    return fallback;
  }

  const trimmed = redirectParam.trim();

  // Reject empty string or paths that do not start with single slash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Reject URLs containing protocol schemes, backslashes, or control characters
  if (trimmed.includes(":") || trimmed.includes("\\") || trimmed.includes("\0")) {
    return fallback;
  }

  // Extract path without query parameters or hash fragments
  const [cleanPath] = trimmed.split(/[?#]/);

  // Normalize path and disallow directory traversal (e.g. /../)
  if (cleanPath.includes("/..") || cleanPath.includes("../")) {
    return fallback;
  }

  const allowedPrefixes = ROLE_ALLOWED_PATHS[role] || [];
  const isAuthorized = allowedPrefixes.some(
    (prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)
  );

  if (!isAuthorized) {
    return fallback;
  }

  return trimmed;
}
