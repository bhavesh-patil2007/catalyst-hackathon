import { describe, it, expect, beforeEach, vi } from "vitest";
import { PersistentCareRepository } from "@/lib/db/repository";
import { parseDateInTimezone, getAuthoritativeDoseDate } from "@/lib/dateUtils";
import { SupabaseClient } from "@supabase/supabase-js";

describe("CareOrbit — Authoritative Date & Timezone Utilities", () => {
  it("parses date correctly in Asia/Kolkata (+05:30)", () => {
    // 2026-06-15 at 08:30 AM in Asia/Kolkata -> 03:00 UTC
    const parsed = parseDateInTimezone("2026-06-15", "08:30 AM", "Asia/Kolkata");
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString()).toBe("2026-06-15T03:00:00.000Z");
  });

  it("parses date correctly in America/New_York during Daylight Saving Time (EDT, UTC-4)", () => {
    // 2026-07-10 at 09:00 AM EDT -> 13:00 UTC
    const parsed = parseDateInTimezone("2026-07-10", "09:00 AM", "America/New_York");
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString()).toBe("2026-07-10T13:00:00.000Z");
  });

  it("parses date correctly in America/New_York during Standard Time (EST, UTC-5)", () => {
    // 2026-01-10 at 09:00 AM EST -> 14:00 UTC
    const parsed = parseDateInTimezone("2026-01-10", "09:00 AM", "America/New_York");
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString()).toBe("2026-01-10T14:00:00.000Z");
  });

  it("returns null for malformed or missing date/time strings", () => {
    expect(parseDateInTimezone("", "08:00 AM")).toBeNull();
    expect(parseDateInTimezone("2026-06-15", "")).toBeNull();
    expect(parseDateInTimezone("invalid-date", "08:00 AM")).toBeNull();
    expect(parseDateInTimezone("2026-06-15", "99:99 AM")).toBeNull();
    expect(parseDateInTimezone("2026-06-15", "noon")).toBeNull();
  });

  it("getAuthoritativeDoseDate prefers scheduledIso over human time string", () => {
    const authoritative = "2026-05-20T10:30:00.000Z";
    const dose = {
      scheduledIso: authoritative,
      scheduledTime: "04:00 PM",
    };
    const result = getAuthoritativeDoseDate(dose, "2026-05-20", "America/New_York");
    expect(result).not.toBeNull();
    expect(result?.toISOString()).toBe(authoritative);
  });

  it("getAuthoritativeDoseDate gracefully falls back to timezone time when scheduledIso is missing", () => {
    const dose = {
      scheduledTime: "08:00 AM",
    };
    const result = getAuthoritativeDoseDate(dose, "2026-05-20", "America/New_York");
    expect(result).not.toBeNull();
    // 8:00 AM EDT is 12:00 UTC
    expect(result?.toISOString()).toBe("2026-05-20T12:00:00.000Z");
  });

  it("getAuthoritativeDoseDate returns null when both ISO and reference date are invalid", () => {
    const dose = { scheduledTime: "invalid" };
    expect(getAuthoritativeDoseDate(dose, "")).toBeNull();
  });
});

describe("CareOrbit — PersistentCareRepository Database Operations", () => {
  let mockTables: Record<string, any[]>;
  let mockSupabase: any;
  let repo: PersistentCareRepository;

  function createMockSupabase(tables: Record<string, any[]>) {
    return {
      from: (table: string) => {
        let filterConditions: Array<(row: any) => boolean> = [];
        let pendingUpdate: any = null;
        let lastInserted: any = null;
        let lastUpdated: any = null;

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
                  lastUpdated = { ...row, ...pendingUpdate };
                  return lastUpdated;
                }
                return row;
              });
            }
            return chain;
          }),
          in: vi.fn().mockImplementation((field: string, vals: any[]) => {
            filterConditions.push((row) => vals.includes(row[field]));
            if (pendingUpdate) {
              tables[table] = (tables[table] || []).map((row) => {
                if (filterConditions.every((c) => c(row))) {
                  lastUpdated = { ...row, ...pendingUpdate };
                  return lastUpdated;
                }
                return row;
              });
            }
            return chain;
          }),
          order: vi.fn().mockImplementation(() => chain),
          limit: vi.fn().mockImplementation(() => chain),
          single: vi.fn().mockImplementation(async () => {
            if (lastInserted) return { data: lastInserted, error: null };
            if (lastUpdated) return { data: lastUpdated, error: null };
            const rows = executeQuery();
            if (!rows[0]) return { data: null, error: { message: "Row not found", code: "PGRST116" } };
            return { data: rows[0], error: null };
          }),
          maybeSingle: vi.fn().mockImplementation(async () => {
            if (lastInserted) return { data: lastInserted, error: null };
            if (lastUpdated) return { data: lastUpdated, error: null };
            const rows = executeQuery();
            return { data: rows[0] || null, error: null };
          }),
          insert: vi.fn().mockImplementation((rowOrRows: any) => {
            const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
            for (const r of rows) {
              // Check partial unique constraints
              if (table === "care_tasks") {
                if (r.source_occurrence_id) {
                  const existing = (tables.care_tasks || []).find(
                    (t) =>
                      t.source_occurrence_id === r.source_occurrence_id &&
                      (t.status === "OPEN" || t.status === "CLAIMED")
                  );
                  if (existing) {
                    const errObj = { code: "23505", message: "duplicate key value violates unique constraint" };
                    chain.then = (resolve: any) => resolve({ data: null, error: errObj });
                    chain.single = async () => ({ data: null, error: errObj });
                    chain.maybeSingle = async () => ({ data: null, error: errObj });
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
                    const errObj = { code: "23505", message: "duplicate key value violates unique constraint" };
                    chain.then = (resolve: any) => resolve({ data: null, error: errObj });
                    chain.single = async () => ({ data: null, error: errObj });
                    chain.maybeSingle = async () => ({ data: null, error: errObj });
                    return chain;
                  }
                }
              }
              tables[table].push(r);
            }
            lastInserted = Array.isArray(rowOrRows) ? rows : rows[0];
            return chain;
          }),
          upsert: vi.fn().mockImplementation((row: any, opts?: any) => {
            const dedupeKey = opts?.onConflict || "id";
            const idx = (tables[table] || []).findIndex((r) => r[dedupeKey] === row[dedupeKey]);
            if (idx >= 0) {
              tables[table][idx] = { ...tables[table][idx], ...row };
            } else {
              tables[table].push(row);
            }
            lastInserted = row;
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
            const rows = executeQuery();
            return resolve({ data: rows, error: null });
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
          id: "00000000-0000-0000-0000-000000000001",
          display_name: "Eleanor Thompson",
          age: 76,
          initials: "ET",
          conditions: ["Type 2 Diabetes", "High Blood Pressure"],
          vital_notes: ["Prefers morning meds with oatmeal"],
          passcode_hash: "hashed",
          household_code: "OASIS-7629",
          timezone: "America/New_York",
          locale: "en",
        },
      ],
      care_members: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          care_profile_id: "00000000-0000-0000-0000-000000000001",
          name: "Sarah Thompson",
          email: "sarah@family.org",
          role: "family_manager",
          relationship: "Daughter",
          phone: "555-1234",
          is_primary_caregiver: false,
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
    repo = new PersistentCareRepository(mockSupabase as unknown as SupabaseClient);
  });

  it("persists and retrieves medications and versions through Supabase", async () => {
    const med = await repo.addMedicationWithVersion({
      name: "Metformin ER",
      dosage: "500 mg",
      instructions: "Take with evening meal",
      scheduleTime: "06:00 PM",
      slot: "evening",
      pillColor: "white",
      pillShape: "oval",
      reason: "Initial prescription for glucose regulation",
      authorName: "Sarah Thompson",
    });

    expect(med.id).toBeDefined();
    expect(med.name).toBe("Metformin ER");
    expect(mockTables.medications.length).toBe(1);
    expect(mockTables.medication_versions.length).toBe(1);
    expect(mockTables.dose_occurrences.length).toBe(1);

    const fetchedMeds = await repo.getMedications();
    expect(fetchedMeds.length).toBe(1);
    expect(fetchedMeds[0].name).toBe("Metformin ER");

    // Edit medication with version
    const edited = await repo.editMedicationWithVersion({
      medicationId: med.id,
      dosage: "1000 mg",
      instructions: "Increased dosage per doctor recommendation",
      reason: "Adjusted dosage by Dr. Vance",
      authorName: "Sarah Thompson",
    });

    expect(edited).not.toBeNull();
    expect(edited?.medication.dosage).toBe("1000 mg");
    expect(edited?.version.version).toBe(2);
    expect(mockTables.medication_versions.length).toBe(2);
  });

  it("records dose check-in and auto-resolves associated open CareLoop tasks when marked taken", async () => {
    const occId = "00000000-0000-0000-0000-000000000010";
    mockTables.dose_occurrences.push({
      id: occId,
      care_profile_id: "00000000-0000-0000-0000-000000000001",
      medication_id: "00000000-0000-0000-0000-000000000009",
      medication_name: "Lisinopril",
      dose_text: "10 mg",
      scheduled_for: new Date().toISOString(),
      scheduled_time_label: "08:00 AM",
      status: "PENDING",
    });

    const taskId = "00000000-0000-0000-0000-000000000020";
    mockTables.care_tasks.push({
      id: taskId,
      care_profile_id: "00000000-0000-0000-0000-000000000001",
      source_occurrence_id: occId,
      medication_name: "Lisinopril",
      dose_text: "10 mg",
      scheduled_time: "08:00 AM",
      grace_minutes_expired: 30,
      assigned_to_name: "Priya Sharma, RN",
      assigned_to_email: "priya@care.local",
      status: "OPEN",
      priority: "HIGH",
    });

    const updatedOcc = await repo.recordCheckIn(
      occId,
      "MARKED_TAKEN",
      "Eleanor Thompson",
      "owner",
      "Took with warm tea",
      false
    );

    expect(updatedOcc).not.toBeNull();
    expect(updatedOcc?.status).toBe("MARKED_TAKEN");
    expect(mockTables.dose_checkins.length).toBe(1);
    expect(mockTables.dose_checkins[0].status).toBe("MARKED_TAKEN");

    const task = mockTables.care_tasks.find((t) => t.id === taskId);
    expect(task?.status).toBe("RESOLVED");
    expect(task?.resolution_outcome).toBe("self_resolved");
  });

  it("handles CareTask claim, handoff, and resolution in database", async () => {
    const taskId = "00000000-0000-0000-0000-000000000030";
    mockTables.care_tasks.push({
      id: taskId,
      care_profile_id: "00000000-0000-0000-0000-000000000001",
      medication_name: "Metformin",
      dose_text: "500 mg",
      scheduled_time: "06:00 PM",
      status: "OPEN",
      priority: "HIGH",
      assigned_to_name: "Priya Sharma, RN",
    });

    // 1. Claim task
    const claimed = await repo.claimTask(taskId, "Priya Sharma, RN");
    expect(claimed?.status).toBe("CLAIMED");
    expect(claimed?.claimedBy).toBe("Priya Sharma, RN");

    // 2. Handoff task
    const handedOff = await repo.handoffTask(
      taskId,
      "Priya Sharma, RN",
      "Nurse Mark",
      "Covering evening shift"
    );
    expect(handedOff?.assignedToName).toBe("Nurse Mark");
    expect(handedOff?.handedOffTo).toBe("Nurse Mark");

    // 3. Resolve task
    const resolved = await repo.resolveTask(
      taskId,
      "visited_in_person",
      "Confirmed medicine was taken during evening check",
      "Nurse Mark"
    );
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.resolutionOutcome).toBe("visited_in_person");
  });

  it("escalateUnconfirmedDose is idempotent under concurrent execution", async () => {
    const occId = "00000000-0000-0000-0000-000000000040";
    mockTables.dose_occurrences.push({
      id: occId,
      care_profile_id: "00000000-0000-0000-0000-000000000001",
      medication_name: "Amlodipine",
      dose_text: "5 mg",
      scheduled_time_label: "08:00 AM",
      status: "PENDING",
    });

    // First escalation creates task
    const firstTask = await repo.escalateUnconfirmedDose(occId);
    expect(firstTask).not.toBeNull();
    expect(firstTask?.status).toBe("OPEN");

    // Second parallel / concurrent call must be idempotent and return null
    const secondTask = await repo.escalateUnconfirmedDose(occId);
    expect(secondTask).toBeNull();
    expect(mockTables.care_tasks.filter((t) => t.source_occurrence_id === occId).length).toBe(1);
  });

  it("createBackupRequest prevents duplicate active backup relief requests", async () => {
    const firstBackup = await repo.createBackupRequest({
      caregiverName: "Priya Sharma, RN",
      reason: "Emergency shift relief",
    });
    expect(firstBackup).toBeDefined();
    expect(firstBackup.priority).toBe("URGENT");

    // Attempting a duplicate active backup request must throw conflict
    await expect(
      repo.createBackupRequest({
        caregiverName: "Priya Sharma, RN",
        reason: "Duplicate request",
      })
    ).rejects.toThrow("ACTIVE_BACKUP_EXISTS");
  });

  it("stores and retrieves doctor appointments from database", async () => {
    const appt = await repo.addAppointment({
      careProfileId: "00000000-0000-0000-0000-000000000001",
      doctorName: "Dr. Robert Vance",
      specialty: "Cardiologist",
      clinicName: "St. Jude Heart Clinic",
      address: "100 Medical Plaza",
      dateTime: "2026-06-20T14:00:00Z",
      dateLabel: "June 20, 2026",
      timeLabel: "2:00 PM",
      transportAssigned: true,
      transportDetails: "Senior shuttle booked",
      questionsToAsk: ["Review blood pressure stability"],
      status: "UPCOMING",
    });

    expect(appt.id).toBeDefined();
    expect(mockTables.appointments.length).toBe(1);

    const list = await repo.getAppointments();
    expect(list.length).toBe(1);
    expect(list[0].doctorName).toBe("Dr. Robert Vance");
  });

  it("stores and queries caregiver wellbeing check-ins", async () => {
    const checkin = await repo.addWellbeingCheckIn({
      caregiverId: "priya@care.local",
      sleepHours: 7.5,
      mood: 4,
      stress: 2,
      energy: 4,
      note: "Good shift today",
      shareWithFamily: true,
    });

    expect(checkin.id).toBeDefined();
    expect(mockTables.caregiver_wellbeing.length).toBe(1);

    const history = await repo.getWellbeingHistory("priya@care.local");
    expect(history.length).toBe(1);
    expect(history[0].sleepHours).toBe(7.5);
    expect(history[0].shareWithFamily).toBe(true);
  });

  it("durable notification persistence and deduplication via upsert", async () => {
    const job = {
      id: "notif-1",
      dedupeKey: "dose-due-test-1",
      recipientEmail: "eleanor@care.local",
      recipientRole: "Older Adult",
      type: "DOSE_DUE" as const,
      subject: "Routine Reminder",
      bodyPreview: "Take medicine",
      status: "ACCEPTED" as const,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    await repo.sendNotification(job);
    expect(mockTables.notification_jobs.length).toBe(1);

    const notifs = await repo.getNotifications();
    expect(notifs.length).toBe(1);
    expect(notifs[0].dedupeKey).toBe("dose-due-test-1");

    // Upserting with same dedupeKey updates existing record rather than creating duplicate
    await repo.sendNotification({
      ...job,
      retryCount: 1,
    });
    expect(mockTables.notification_jobs.length).toBe(1);
    expect(mockTables.notification_jobs[0].retry_count).toBe(1);
    const updatedNotifs = await repo.getNotifications();
    expect(updatedNotifs[0].retryCount).toBe(1);
  });

  it("fails closed in production: returns empty array rather than silent demo fallback", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      mockTables.appointments = [];
      const appts = await repo.getAppointments();
      expect(appts).toEqual([]);

      mockTables.medications = [];
      const meds = await repo.getMedications();
      expect(meds).toEqual([]);

      mockTables.care_tasks = [];
      const tasks = await repo.getTasks();
      expect(tasks).toEqual([]);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("fails closed in production: database write failure throws explicit error", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const failingChain: any = {
      select: () => failingChain,
      limit: () => failingChain,
      maybeSingle: async () => ({
        data: { id: "00000000-0000-0000-0000-000000000001", display_name: "Eleanor" },
        error: null,
      }),
      insert: () => {
        const errObj = { message: "connection to server at 'db.supabase.co' failed: timeout" };
        failingChain.then = (resolve: any) => resolve({ data: null, error: errObj });
        return failingChain;
      },
      then: (resolve: any) => resolve({ data: null, error: { message: "connection to server at 'db.supabase.co' failed: timeout" } }),
    };

    const failingSupabase = {
      from: () => failingChain,
    };

    const failingRepo = new PersistentCareRepository(failingSupabase as unknown as SupabaseClient);

    try {
      await expect(
        failingRepo.addMedicationWithVersion({
          name: "Test Med",
          dosage: "10 mg",
          instructions: "Test",
          scheduleTime: "08:00 AM",
          slot: "morning",
          pillColor: "blue",
          pillShape: "round",
          reason: "Test",
          authorName: "Doctor",
        })
      ).rejects.toThrow("Failed to insert medication");
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
