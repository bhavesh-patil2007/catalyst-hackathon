#!/usr/bin/env node
import Module from "module";

// Stub server-only package in CLI execution environment outside Next.js
const origRequire = (Module as any).prototype.require;
(Module as any).prototype.require = function (id: string, ...args: any[]) {
  if (id === "server-only") return {};
  return origRequire.apply(this, [id, ...args]);
};

async function main() {
  const { bootstrapProductionCredentials } = await import("../src/lib/auth/bootstrap");
  console.log("=== CareOrbit (Guardian Oasis) — Production Credential Bootstrapper ===");

  const ownerPin = process.env.BOOTSTRAP_OWNER_PIN;
  const familyManagerCode = process.env.BOOTSTRAP_FAMILY_MANAGER_CODE;
  const caregiverCode = process.env.BOOTSTRAP_CAREGIVER_CODE;
  const observerCode = process.env.BOOTSTRAP_OBSERVER_CODE;
  const profileName = process.env.BOOTSTRAP_PROFILE_NAME || "Eleanor Thompson";

  if (!ownerPin || !familyManagerCode || !caregiverCode) {
    console.error("ERROR: Missing required bootstrap environment variables.");
    console.error("Required variables:");
    console.error("  BOOTSTRAP_OWNER_PIN            (e.g., 4 to 6 digit senior passcode)");
    console.error("  BOOTSTRAP_FAMILY_MANAGER_CODE  (e.g., secure invite code for family manager)");
    console.error("  BOOTSTRAP_CAREGIVER_CODE       (e.g., secure invite code for primary nurse/caregiver)");
    console.error("Optional variables:");
    console.error("  BOOTSTRAP_OBSERVER_CODE        (e.g., invite code for read-only member)");
    console.error("  BOOTSTRAP_PROFILE_NAME         (default: 'Eleanor Thompson')");
    process.exit(1);
  }

  try {
    const result = await bootstrapProductionCredentials({
      ownerPin,
      familyManagerCode,
      caregiverCode,
      observerCode,
      profileName,
      ownerEmail: process.env.BOOTSTRAP_OWNER_EMAIL,
      familyEmail: process.env.BOOTSTRAP_FAMILY_EMAIL,
      caregiverEmail: process.env.BOOTSTRAP_CAREGIVER_EMAIL,
      observerEmail: process.env.BOOTSTRAP_OBSERVER_EMAIL,
    });

    console.log("SUCCESS: CareOrbit production credentials provisioned successfully.");
    console.log(`Care Profile ID: ${result.profileId}`);
    console.log(`Owner Member ID: ${result.memberIds.owner}`);
    console.log(`Family Manager Member ID: ${result.memberIds.familyManager}`);
    console.log(`Caregiver Member ID: ${result.memberIds.caregiver}`);
    if (result.memberIds.observer) {
      console.log(`Observer Member ID: ${result.memberIds.observer}`);
    }
  } catch (err: any) {
    console.error(`BOOTSTRAP FAILED: ${err?.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
