import crypto from "crypto";

/**
 * Enterprise credential hashing and verification for CareOrbit (Guardian Oasis).
 * Uses salted scrypt key derivation and constant-time comparison to protect PINs and codes.
 */

export interface HashedCredential {
  hash: string;
  salt: string;
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
 * Detects whether a credential is a known hardcoded demo credential.
 * In production (NODE_ENV=production), demo credentials MUST NEVER authenticate.
 */
export function isDemoCredential(secret: string): boolean {
  const normalized = secret.trim().toUpperCase();
  return normalized === "1234" || normalized === "OASIS-7629";
}

/**
 * Pre-computed salted hashes for development / demo mode.
 * In production, genuine patient accounts must be provisioned in PostgreSQL with unique salts.
 */
export const DEMO_CREDENTIALS = {
  elderPin: {
    pin: "1234",
    salt: "d83f2a1b9c7e4d6f0a5b8c2e1f3a7d9b",
    hash: crypto.scryptSync("1234", "d83f2a1b9c7e4d6f0a5b8c2e1f3a7d9b", 64).toString("hex"),
  },
  circleCode: {
    code: "OASIS-7629",
    salt: "e4a2b9c7d1f8a3b5c6d9e0f2a4b6c8d0",
    hash: crypto.scryptSync("OASIS-7629", "e4a2b9c7d1f8a3b5c6d9e0f2a4b6c8d0", 64).toString("hex"),
  },
};
