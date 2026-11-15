import { describe, it, expect, beforeEach, vi } from "vitest";
import { PersistentCareRepository } from "@/lib/db/repository";
import { hashSecret } from "@/lib/authCrypto";
import { sanitizeRedirectUrl } from "@/lib/redirectSecurity";
import { checkDistributedLoginRateLimit, resetLoginRateLimit } from "@/lib/rateLimit";
import { POST as elderPinHandler } from "@/app/api/auth/elder-pin/route";
import { POST as circleCodeHandler } from "@/app/api/auth/circle-code/route";
import { GET as healthHandler } from "@/app/api/health/route";
import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Mock iron-session
const mockSessionStore: Record<string, any> = {};
vi.mock("@/lib/session", () => ({
  getSession: vi.fn().mockImplementation(async () => {
    return {
      authenticated: mockSessionStore.authenticated || false,
      role: mockSessionStore.role,
      profileId: mockSessionStore.profileId,
      memberId: mockSessionStore.memberId,
      memberName: mockSessionStore.memberName,
      save: async function () {
        mockSessionStore.authenticated = this.authenticated;
        mockSessionStore.role = this.role;
        mockSessionStore.profileId = this.profileId;
        mockSessionStore.memberId = this.memberId;
        mockSessionStore.memberName = this.memberName;
      },
      destroy: function () {
        for (const k of Object.keys(mockSessionStore)) {
          delete mockSessionStore[k];
        }
      },
    };
  }),
}));

describe("CareOrbit — Production Authentication & Security Guardrails", () => {
  describe("Open-Redirect & Role-Based Navigation Protection", () => {
    it("rejects absolute external URLs and falls back to role default destination", () => {
      expect(sanitizeRedirectUrl("https://attacker.com/steal-phi", "caregiver")).toBe("/caregiver");
      expect(sanitizeRedirectUrl("http://evil.com/login", "family_manager")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("javascript:alert(1)", "owner")).toBe("/elder");
    });

    it("rejects protocol-relative and backslash-prefixed destinations", () => {
      expect(sanitizeRedirectUrl("//attacker.com", "caregiver")).toBe("/caregiver");
      expect(sanitizeRedirectUrl("/\\attacker.com", "family_manager")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("\\evil.com", "owner")).toBe("/elder");
      expect(sanitizeRedirectUrl("/../etc/passwd", "caregiver")).toBe("/caregiver");
    });

    it("enforces role boundaries on redirect paths", () => {
      // Older adult (owner) cannot navigate to caregiver or manager dashboard
      expect(sanitizeRedirectUrl("/dashboard", "owner")).toBe("/elder");
      expect(sanitizeRedirectUrl("/caregiver", "owner")).toBe("/elder");

      // Valid destinations within role permissions are accepted
      expect(sanitizeRedirectUrl("/elder", "owner")).toBe("/elder");
      expect(sanitizeRedirectUrl("/timeline", "owner")).toBe("/timeline");
      expect(sanitizeRedirectUrl("/dashboard", "family_manager")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("/medications", "caregiver")).toBe("/medications");
      expect(sanitizeRedirectUrl("/wellbeing", "caregiver")).toBe("/wellbeing");
    });
  });

  describe("Distributed Login Rate Limiting", () => {
    it("enforces attempt limits and calculates retry-after timeout", async () => {
      const testKey = `test-ip-${Date.now()}`;
      await resetLoginRateLimit(testKey);

      for (let i = 0; i < 5; i++) {
        const res = await checkDistributedLoginRateLimit(testKey, 5, 60_000);
        expect(res.allowed).toBe(true);
      }

      // 6th attempt must be blocked
      const blocked = await checkDistributedLoginRateLimit(testKey, 5, 60_000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingAttempts).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

      // Reset allows access immediately
      await resetLoginRateLimit(testKey);
      const afterReset = await checkDistributedLoginRateLimit(testKey, 5, 60_000);
      expect(afterReset.allowed).toBe(true);
    });
  });

  describe("Production Health Check Fail-Closed Behavior", () => {
    it("reports 503 unhealthy in production when database is unconfigured or in-memory", async () => {
      const origEnv = process.env.NODE_ENV;
      const origUrl = process.env.SUPABASE_URL;
      const origPg = process.env.DATABASE_URL;

      (process.env as any).NODE_ENV = "production";
      delete process.env.SUPABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        const res = await healthHandler();
        expect(res.status).toBe(503);

        const body = await res.json();
        expect(body.status).toBe("unhealthy");
        expect(body.checks.database.connected).toBe(false);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        if (origUrl) process.env.SUPABASE_URL = origUrl;
        if (origPg) process.env.DATABASE_URL = origPg;
      }
    });
  });
});

describe("CareOrbit — Supabase PersistentCareRepository End-to-End Persistence", () => {
  let mockTables: Record<string, any[]>;
  let mockSupabase: any;
  let repo1: PersistentCareRepository;
  let repo2: PersistentCareRepository;

  const profile1Id = "11111111-1111-1111-1111-111111111111";
  const profile2Id = "22222222-2222-2222-2222-222222222222";

  function createMockSupabase(tables: Record<string, any[]>) {
    return {
      rpc: vi.fn().mockImplementation(async (funcName: string, args: any) => {
        if (funcName === "create_medication_atomically") {
          const medId = crypto.randomUUID();
          const verId = crypto.randomUUID();
          const occId = crypto.randomUUID();
          tables.medications.push({
            id: medId,
            care_profile_id: args.p_profile_id,
            name: args.p_name,
            dosage: args.p_dosage,
            instructions: args.p_instructions,
            schedule_time: args.p_schedule_time,
            slot: args.p_slot,
            pill_color: args.p_pill_color,
            pill_shape: args.p_pill_shape,
            current_version: 1,
            remaining_quantity: 30,
            refill_threshold: 7,
            daily_frequency: 1,
            active: true,
          });
          tables.medication_versions.push({
            id: verId,
            medication_id: medId,
            version: 1,
            label_name: args.p_name,
            dose_text: args.p_dosage,
            instructions: args.p_instructions,
            effective_from: new Date().toISOString().slice(0, 10),
            created_by: args.p_author_name,
            reason: args.p_reason,
          });
          tables.dose_occurrences.push({
            id: occId,
            care_profile_id: args.p_profile_id,
            medication_id: medId,
            medication_name: args.p_name,
            dose_text: args.p_dosage,
            scheduled_for: new Date().toISOString(),
            scheduled_time_label: args.p_schedule_time,
            status: "SCHEDULED",
            instructions: args.p_instructions,
          });
          return { data: { success: true, medicationId: medId, versionId: verId }, error: null };
        }
        return { data: null, error: { message: "Unknown RPC" } };
      }),
      from: (table: string) => {
        let filterConditions: Array<(row: any) => boolean> = [];
        let pendingUpdate: any = null;
        let lastInserted: any = null;

        const executeQuery = () => {
          let res = [...(tables[table] || [])];
          for (const cond of filterConditions) {
            res = res.filter(cond);
          }
          return res;
        };

        const chain: any = {
          select: vi.fn().mockImplementation(() => chain),
          eq: vi.fn().mockImplementation((field: string, val: any) => {
            filterConditions.push((row) => row[field] === val);
            if (pendingUpdate) {
              tables[table] = (tables[table] || []).map((row) => {
                if (filterConditions.every((c) => c(row))) {
                  return { ...row, ...pendingUpdate };
                }
                return row;
              });
            }
            return chain;
          }),
          in: vi.fn().mockImplementation((field: string, vals: any[]) => {
            filterConditions.push((row) => vals.includes(row[field]));
            return chain;
          }),
          order: vi.fn().mockImplementation(() => chain),
          limit: vi.fn().mockImplementation(() => chain),
          single: vi.fn().mockImplementation(async () => {
            const rows = executeQuery();
            if (!rows[0]) return { data: null, error: { message: "Row not found", code: "PGRST116" } };
            return { data: rows[0], error: null };
          }),
          maybeSingle: vi.fn().mockImplementation(async () => {
            const rows = executeQuery();
            return { data: rows[0] || null, error: null };
          }),
          insert: vi.fn().mockImplementation((rowOrRows: any) => {
            const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
            for (const r of rows) {
              if (table === "care_tasks") {
                if (r.source_occurrence_id) {
                  const existing = (tables.care_tasks || []).find(
                    (t) =>
                      t.source_occurrence_id === r.source_occurrence_id &&
                      (t.status === "OPEN" || t.status === "CLAIMED")
                  );
                  if (existing) {
                    const err = { code: "23505", message: "unique constraint violation" };
                    chain.then = (res: any) => res({ data: null, error: err });
                    chain.single = async () => ({ data: null, error: err });
                    return chain;
                  }
                }
                if (r.medication_name === "Caregiver Relief Coverage") {
                  const existingBackup = (tables.care_tasks || []).find(
                    (t) =>
                      t.care_profile_id === r.care_profile_id &&
                      t.medication_name === "Caregiver Relief Coverage" &&
                      (t.status === "OPEN" || t.status === "CLAIMED")
                  );
                  if (existingBackup) {
                    const err = { code: "23505", message: "unique constraint violation" };
                    chain.then = (res: any) => res({ data: null, error: err });
                    chain.single = async () => ({ data: null, error: err });
                    return chain;
                  }
                }
              }
              tables[table].push(r);
            }
            lastInserted = Array.isArray(rowOrRows) ? rows : rows[0];
            return chain;
          }),
          update: vi.fn().mockImplementation((updates: any) => {
            pendingUpdate = updates;
            return chain;
          }),
          then: (resolve: any) => {
            if (lastInserted) {
              return resolve({ data: lastInserted, error: null });
            }
            return resolve({ data: executeQuery(), error: null });
          },
        };

        return chain;
      },
    };
  }

  beforeEach(() => {
    mockTables = {
      care_profiles: [
        {
          id: profile1Id,
          display_name: "Eleanor Thompson",
          age: 76,
          initials: "ET",
          conditions: ["Type 2 Diabetes"],
          vital_notes: ["Prefers morning routine"],
          passcode_hash: "hashed",
          household_code: "OASIS-7629",
          timezone: "America/New_York",
          locale: "en",
        },
        {
          id: profile2Id,
          display_name: "Arthur Pendelton",
          age: 82,
          initials: "AP",
          conditions: ["Hypertension"],
          vital_notes: ["Requires walker"],
          passcode_hash: "hashed",
          household_code: "OASIS-9999",
          timezone: "America/New_York",
          locale: "en",
        },
      ],
      care_members: [
        {
          id: "mem-1",
          care_profile_id: profile1Id,
          name: "Eleanor Thompson",
          email: "eleanor@oasis.local",
          role: "owner",
          relationship: "Self",
          status: "ACTIVE",
        },
      ],
      medications: [],
      medication_versions: [],
      dose_occurrences: [],
      dose_checkins: [],
      appointments: [],
      care_tasks: [],
      notification_jobs: [],
      audit_events: [],
      caregiver_wellbeing: [],
    };

    mockSupabase = createMockSupabase(mockTables);
    repo1 = new PersistentCareRepository(mockSupabase as unknown as SupabaseClient);
    repo2 = new PersistentCareRepository(mockSupabase as unknown as SupabaseClient);
  });

  it("persists data across separate repository instances", async () => {
    // Instance 1 creates medication via atomic RPC
    const created = await repo1.addMedicationWithVersion({
      careProfileId: profile1Id,
      name: "Atorvastatin Calcium",
      dosage: "20 mg",
      instructions: "Take once daily in evening",
      scheduleTime: "08:00 PM",
      slot: "evening",
      pillColor: "white",
      pillShape: "oval",
      reason: "Cholesterol management",
      authorName: "Dr. Vance",
    });

    expect(created.id).toBeDefined();

    // Fresh Instance 2 reads medications and verifies persistence
    const medsInstance2 = await repo2.getMedications(profile1Id);
    expect(medsInstance2.length).toBe(1);
    expect(medsInstance2[0].name).toBe("Atorvastatin Calcium");
    expect(medsInstance2[0].dosage).toBe("20 mg");

    // Version history is persisted in database
    const versions = await repo2.getMedicationVersions(created.id);
    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe(1);
    expect(versions[0].labelName).toBe("Atorvastatin Calcium");
  });

  it("guarantees cross-profile data isolation", async () => {
    // Add medication to Profile 1
    await repo1.addMedicationWithVersion({
      careProfileId: profile1Id,
      name: "Metformin ER",
      dosage: "500 mg",
      instructions: "Take with breakfast",
      scheduleTime: "08:00 AM",
      slot: "morning",
      pillColor: "blue",
      pillShape: "capsule",
      reason: "Diabetes",
      authorName: "Nurse Mark",
    });

    // Profile 1 query must find it
    const profile1Meds = await repo1.getMedications(profile1Id);
    expect(profile1Meds.length).toBe(1);

    // Profile 2 query must return empty list (strict isolation)
    const profile2Meds = await repo2.getMedications(profile2Id);
    expect(profile2Meds).toEqual([]);

    // Profile 2 appointments query must return empty list
    const profile2Appts = await repo2.getAppointments(profile2Id);
    expect(profile2Appts).toEqual([]);
  });

  it("enforces fail-closed behavior when profile is not found in production", async () => {
    const origEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    try {
      await expect(
        repo1.getProfile("00000000-0000-0000-0000-000000000099")
      ).rejects.toThrow("Care profile not found in persistent database");
    } finally {
      (process.env as any).NODE_ENV = origEnv;
    }
  });

  it("propagates database errors without false positive success", async () => {
    const failingSupabase = {
      from: () => ({
        select: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: { id: profile1Id, display_name: "Eleanor" },
              error: null,
            }),
          }),
        }),
        insert: () => {
          const err = { message: "database disk quota exceeded" };
          const chain: any = {
            select: () => ({
              single: async () => ({ data: null, error: err }),
            }),
            then: (resolve: any) => resolve({ data: null, error: err }),
          };
          return chain;
        },
      }),
    };

    const failingRepo = new PersistentCareRepository(failingSupabase as unknown as SupabaseClient);

    await expect(
      failingRepo.addAppointment({
        careProfileId: profile1Id,
        doctorName: "Dr. Smith",
        specialty: "Geriatrics",
        clinicName: "General Clinic",
        address: "Main St",
        dateTime: new Date().toISOString(),
        dateLabel: "Today",
        timeLabel: "10:00 AM",
        transportAssigned: false,
        status: "UPCOMING",
        questionsToAsk: [],
      })
    ).rejects.toThrow("Failed to persist appointment");
  });
});
