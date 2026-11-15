import { hashSecret } from "@/lib/authCrypto";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { query } from "@/lib/db";
import crypto from "crypto";

export interface BootstrapConfig {
  ownerPin: string;
  familyManagerCode: string;
  caregiverCode: string;
  observerCode?: string;
  profileName?: string;
  ownerEmail?: string;
  caregiverEmail?: string;
  familyEmail?: string;
  observerEmail?: string;
  householdCode?: string;
  timezone?: string;
}

export interface BootstrapResult {
  success: boolean;
  profileId: string;
  memberIds: {
    owner: string;
    familyManager: string;
    caregiver: string;
    observer?: string;
  };
  credentialIds: string[];
}

/**
 * Bootstraps production credentials in PostgreSQL/Supabase.
 * Strictly requires environment-provided secrets; never uses or accepts default demo credentials.
 */
export async function bootstrapProductionCredentials(
  config: BootstrapConfig
): Promise<BootstrapResult> {
  const {
    ownerPin,
    familyManagerCode,
    caregiverCode,
    observerCode,
    profileName = "Eleanor Thompson",
    ownerEmail = "eleanor.thompson@oasiscare.internal",
    familyEmail = "sarah.thompson@family.internal",
    caregiverEmail = "priya.sharma@oasiscare.internal",
    observerEmail = "observer@family.internal",
    householdCode = `OASIS-${Math.floor(1000 + Math.random() * 9000)}`,
    timezone = "America/New_York",
  } = config;

  if (!ownerPin || ownerPin.trim().length < 4) {
    throw new Error(
      "FATAL: BOOTSTRAP_OWNER_PIN must be provided and be at least 4 characters long."
    );
  }

  if (!familyManagerCode || familyManagerCode.trim().length < 6) {
    throw new Error(
      "FATAL: BOOTSTRAP_FAMILY_MANAGER_CODE must be provided and be at least 6 characters long."
    );
  }

  if (!caregiverCode || caregiverCode.trim().length < 6) {
    throw new Error(
      "FATAL: BOOTSTRAP_CAREGIVER_CODE must be provided and be at least 6 characters long."
    );
  }

  // Pre-hash all credentials with salted scrypt
  const ownerCred = hashSecret(ownerPin);
  const familyCred = hashSecret(familyManagerCode);
  const caregiverCred = hashSecret(caregiverCode);
  const observerCred = observerCode ? hashSecret(observerCode) : null;

  const profileId = crypto.randomUUID();
  const ownerMemberId = crypto.randomUUID();
  const familyMemberId = crypto.randomUUID();
  const caregiverMemberId = crypto.randomUUID();
  const observerMemberId = observerCode ? crypto.randomUUID() : undefined;
  const ownerUserId = crypto.randomUUID();

  const supabase = getSupabaseServerClient();

  if (supabase) {
    // 1. Create or get existing profile
    const { data: existingProfile } = await supabase
      .from("care_profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    const targetProfileId = existingProfile?.id || profileId;

    if (!existingProfile) {
      const { error: profileErr } = await supabase.from("care_profiles").insert({
        id: targetProfileId,
        owner_user_id: ownerUserId,
        display_name: profileName,
        age: 76,
        initials: profileName.split(" ").map((n) => n[0]).join(""),
        conditions: ["Type 2 Diabetes", "High Blood Pressure"],
        vital_notes: ["Prefers morning routine with light meal"],
        passcode_hash: ownerCred.hash,
        household_code: householdCode,
        timezone,
        locale: "en",
      });

      if (profileErr) {
        throw new Error(`Failed to create care profile: ${profileErr.message}`);
      }
    }

    // 2. Insert Care Members
    const membersToInsert = [
      {
        id: ownerMemberId,
        care_profile_id: targetProfileId,
        user_id: crypto.randomUUID(),
        name: profileName,
        email: ownerEmail,
        role: "owner",
        relationship: "Self (Older Adult)",
        is_primary_caregiver: false,
        status: "ACTIVE",
      },
      {
        id: familyMemberId,
        care_profile_id: targetProfileId,
        user_id: crypto.randomUUID(),
        name: "Primary Family Manager",
        email: familyEmail,
        role: "family_manager",
        relationship: "Family Sponsor",
        is_primary_caregiver: false,
        status: "ACTIVE",
      },
      {
        id: caregiverMemberId,
        care_profile_id: targetProfileId,
        user_id: crypto.randomUUID(),
        name: "Primary Caregiver, RN",
        email: caregiverEmail,
        role: "caregiver",
        relationship: "Lead Healthcare Provider",
        is_primary_caregiver: true,
        status: "ACTIVE",
      },
    ];

    if (observerMemberId) {
      membersToInsert.push({
        id: observerMemberId,
        care_profile_id: targetProfileId,
        user_id: crypto.randomUUID(),
        name: "Care Circle Observer",
        email: observerEmail,
        role: "read_only",
        relationship: "Family Observer",
        is_primary_caregiver: false,
        status: "ACTIVE",
      });
    }

    const { error: membersErr } = await supabase.from("care_members").insert(membersToInsert);
    if (membersErr) {
      throw new Error(`Failed to insert care members: ${membersErr.message}`);
    }

    // 3. Insert Auth Credentials
    const credentialsToInsert = [
      {
        id: crypto.randomUUID(),
        care_profile_id: targetProfileId,
        care_member_id: ownerMemberId,
        credential_type: "elder_pin",
        credential_hash: ownerCred.hash,
        credential_salt: ownerCred.salt,
        role: "owner",
        revoked: false,
      },
      {
        id: crypto.randomUUID(),
        care_profile_id: targetProfileId,
        care_member_id: familyMemberId,
        credential_type: "circle_invite",
        credential_hash: familyCred.hash,
        credential_salt: familyCred.salt,
        role: "family_manager",
        revoked: false,
      },
      {
        id: crypto.randomUUID(),
        care_profile_id: targetProfileId,
        care_member_id: caregiverMemberId,
        credential_type: "circle_invite",
        credential_hash: caregiverCred.hash,
        credential_salt: caregiverCred.salt,
        role: "caregiver",
        revoked: false,
      },
    ];

    if (observerMemberId && observerCred) {
      credentialsToInsert.push({
        id: crypto.randomUUID(),
        care_profile_id: targetProfileId,
        care_member_id: observerMemberId,
        credential_type: "circle_invite",
        credential_hash: observerCred.hash,
        credential_salt: observerCred.salt,
        role: "read_only",
        revoked: false,
      });
    }

    const { data: insertedCreds, error: credErr } = await supabase
      .from("auth_credentials")
      .insert(credentialsToInsert)
      .select("id");

    if (credErr) {
      throw new Error(`Failed to insert auth credentials: ${credErr.message}`);
    }

    return {
      success: true,
      profileId: targetProfileId,
      memberIds: {
        owner: ownerMemberId,
        familyManager: familyMemberId,
        caregiver: caregiverMemberId,
        observer: observerMemberId,
      },
      credentialIds: (insertedCreds || []).map((c) => c.id),
    };
  }

  // 4. Fallback PostgreSQL direct connection
  const res = await query(
    `INSERT INTO care_profiles (id, owner_user_id, display_name, age, initials, passcode_hash, household_code, timezone)
     VALUES ($1, $2, $3, 76, 'ET', $4, $5, $6)
     ON CONFLICT (household_code) DO NOTHING
     RETURNING id;`,
    [profileId, ownerUserId, profileName, ownerCred.hash, householdCode, timezone]
  );

  const targetId = res?.rows[0]?.id || profileId;

  await query(
    `INSERT INTO care_members (id, care_profile_id, user_id, name, email, role, relationship, is_primary_caregiver)
     VALUES 
     ($1, $2, $3, $4, $5, 'owner', 'Self (Older Adult)', false),
     ($6, $2, $7, 'Primary Family Manager', $8, 'family_manager', 'Family Contact', false),
     ($9, $2, $10, 'Primary Caregiver, RN', $11, 'caregiver', 'Lead Nurse', true);`,
    [
      ownerMemberId,
      targetId,
      ownerUserId,
      profileName,
      ownerEmail,
      familyMemberId,
      crypto.randomUUID(),
      familyEmail,
      caregiverMemberId,
      crypto.randomUUID(),
      caregiverEmail,
    ]
  );

  await query(
    `INSERT INTO auth_credentials (id, care_profile_id, care_member_id, credential_type, credential_hash, credential_salt, role)
     VALUES
     ($1, $2, $3, 'elder_pin', $4, $5, 'owner'),
     ($6, $2, $7, 'circle_invite', $8, $9, 'family_manager'),
     ($10, $2, $11, 'circle_invite', $12, $13, 'caregiver');`,
    [
      crypto.randomUUID(),
      targetId,
      ownerMemberId,
      ownerCred.hash,
      ownerCred.salt,
      crypto.randomUUID(),
      targetId,
      familyMemberId,
      familyCred.hash,
      familyCred.salt,
      crypto.randomUUID(),
      targetId,
      caregiverMemberId,
      caregiverCred.hash,
      caregiverCred.salt,
    ]
  );

  return {
    success: true,
    profileId: targetId,
    memberIds: {
      owner: ownerMemberId,
      familyManager: familyMemberId,
      caregiver: caregiverMemberId,
    },
    credentialIds: [],
  };
}
