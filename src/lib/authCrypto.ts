import crypto from "crypto";
import { UserRole } from "@/types";

/**
 * Enterprise credential hashing and verification for CareOrbit (Guardian Oasis).
 * Uses salted scrypt key derivation and constant-time comparison to protect PINs and codes.
 */

export interface HashedCredential {
  hash: string;
  salt: string;
}

export interface CircleInvitation {
  code: string;
  role: UserRole;
  label: string;
  salt: string;
  hash: string;
}

/**
 * Derives a cryptographic hash of a PIN or invite code using scrypt.
 */
export function hashSecret(secret: string, customSalt?: string): HashedCredential {
  const salt = customSalt || crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(secret.trim(), salt, 64);
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Constant-time verification of a supplied secret against stored hash and salt.
 */
export function verifySecret(suppliedSecret: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(suppliedSecret.trim(), salt, 64);
    const storedBuffer = Buffer.from(storedHash, "hex");
    if (derivedKey.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Known hardcoded demo credentials.
 * In production (NODE_ENV=production), demo credentials MUST NEVER authenticate.
 */
export const DEMO_CREDENTIALS_LIST = [
  "1234",
  "OASIS-7629",
  "CAREGIVER-4192",
  "OBSERVER-8301",
];

export function isDemoCredential(secret: string): boolean {
  const normalized = secret.trim().toUpperCase();
  return DEMO_CREDENTIALS_LIST.includes(normalized);
}

/**
 * Pre-computed salted hashes for development / demo mode.
 * Each invitation code maps DETERMINISTICALLY to a specific server-assigned role.
 * The client CANNOT specify or alter this role.
 */
export const DEMO_INVITATIONS: Record<string, CircleInvitation> = {
  FAMILY_MANAGER: {
    code: "OASIS-7629",
    role: "family_manager",
    label: "Family Manager Invitation",
    salt: "e4a2b9c7d1f8a3b5c6d9e0f2a4b6c8d0",
    hash: crypto.scryptSync("OASIS-7629", "e4a2b9c7d1f8a3b5c6d9e0f2a4b6c8d0", 64).toString("hex"),
  },
  CAREGIVER: {
    code: "CAREGIVER-4192",
    role: "caregiver",
    label: "Primary Caregiver Invitation",
    salt: "f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    hash: crypto.scryptSync("CAREGIVER-4192", "f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", 64).toString("hex"),
  },
  READ_ONLY: {
    code: "OBSERVER-8301",
    role: "read_only",
    label: "Read-Only Care Circle Invitation",
    salt: "a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4",
    hash: crypto.scryptSync("OBSERVER-8301", "a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4", 64).toString("hex"),
  },
};

export const DEMO_CREDENTIALS = {
  elderPin: {
    pin: "1234",
    salt: "d83f2a1b9c7e4d6f0a5b8c2e1f3a7d9b",
    hash: crypto.scryptSync("1234", "d83f2a1b9c7e4d6f0a5b8c2e1f3a7d9b", 64).toString("hex"),
  },
  circleCode: DEMO_INVITATIONS.FAMILY_MANAGER,
};

/**
 * Server-side verification of a circle invitation code.
 * Strictly derives the user's role from the verified invitation credential,
 * NEVER from any client-supplied role parameter.
 */
export function verifyCircleInvitation(code: string): {
  valid: boolean;
  role?: UserRole;
  label?: string;
} {
  const normalized = code.trim().toUpperCase();

  // In production, reject known demo codes
  if (process.env.NODE_ENV === "production" && isDemoCredential(normalized)) {
    return { valid: false };
  }

  // Check against invitation records
  for (const inv of Object.values(DEMO_INVITATIONS)) {
    if (verifySecret(normalized, inv.hash, inv.salt)) {
      return {
        valid: true,
        role: inv.role,
        label: inv.label,
      };
    }
  }

  return { valid: false };
}
