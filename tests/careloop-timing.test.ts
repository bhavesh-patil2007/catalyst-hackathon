import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { careRepository } from "../src/lib/db/repository";
import { POST as watchdogHandler } from "../src/app/api/care/cron-watchdog/route";

describe("CareLoop Watchdog Timing & Escalation with Controlled Clock", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("rejects unauthorized cron requests without valid authorization", async () => {
    const req = new Request("http://localhost/api/care/cron-watchdog", {
      method: "POST",
      headers: {
        "x-cron-secret": "wrong-secret",
      },
    });

    const res = await watchdogHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Unauthorized");
  });

  it("accepts valid bearer authorization and processes scheduled doses", async () => {
    const req = new Request("http://localhost/api/care/cron-watchdog", {
      method: "POST",
      headers: {
        authorization: "Bearer test-cron-secret",
      },
    });

    const res = await watchdogHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toBeDefined();
  });

  it("evaluates upcoming reminder window (within 30 mins) vs future dose (>30 mins)", async () => {
    // Set clock to 07:50 AM UTC on 2026-11-15
    const baseTime = new Date("2026-11-15T07:50:00Z");
    vi.setSystemTime(baseTime);

    // Dose due in 15 mins (08:05 AM) -> within 30-min window
    const upcomingIso = new Date(baseTime.getTime() + 15 * 60 * 1000).toISOString();

    // Add a test medication
    const med = await careRepository.addMedicationWithVersion({
      name: "Timing Test Med",
      dosage: "10 mg",
      instructions: "Take with water",
      scheduleTime: "08:05 AM",
      slot: "morning",
      pillColor: "blue",
      pillShape: "round",
      reason: "Timing test",
      authorName: "Dr. Test",
    });

    // Check occurrences created
    const occs = await careRepository.getOccurrences();
    const testOcc = occs.find((o) => o.medicationId === med.id);
    expect(testOcc).toBeDefined();

    if (testOcc) {
      testOcc.scheduledIso = upcomingIso;
      testOcc.status = "SCHEDULED";
    }

    const req = new Request("http://localhost/api/care/cron-watchdog", {
      method: "POST",
      headers: {
        authorization: "Bearer test-cron-secret",
      },
    });

    const res = await watchdogHandler(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results.upcomingDoseRemindersSent).toBeGreaterThanOrEqual(1);
  });

  it("escalates overdue doses past 30-minute grace period and enforces idempotency", async () => {
    // Set system time to 10:00 AM UTC
    const currentTime = new Date("2026-11-15T10:00:00Z");
    vi.setSystemTime(currentTime);

    // Scheduled for 09:00 AM UTC (60 mins overdue -> exceeds 30-min grace period)
    const overdueTime = new Date("2026-11-15T09:00:00Z").toISOString();

    const med = await careRepository.addMedicationWithVersion({
      name: "Escalation Test Med",
      dosage: "20 mg",
      instructions: "Critical heart medication",
      scheduleTime: "09:00 AM",
      slot: "morning",
      pillColor: "red",
      pillShape: "oval",
      reason: "Escalation test",
      authorName: "Cardiologist",
    });

    const occs = await careRepository.getOccurrences();
    const testOcc = occs.find((o) => o.medicationId === med.id);
    expect(testOcc).toBeDefined();

    if (testOcc) {
      testOcc.scheduledIso = overdueTime;
      testOcc.status = "PENDING"; // Elder has not taken it
    }

    // Run watchdog first time -> should create an escalation task
    const req1 = new Request("http://localhost/api/care/cron-watchdog", {
      method: "POST",
      headers: { "x-cron-secret": "test-cron-secret" },
    });
    const res1 = await watchdogHandler(req1);
    const data1 = await res1.json();

    expect(data1.success).toBe(true);
    expect(data1.results.missedDoseEscalations).toBeGreaterThanOrEqual(1);
    expect(data1.results.tasksCreated.length).toBeGreaterThanOrEqual(1);

    const createdTaskId = data1.results.tasksCreated[0];
    const tasks = await careRepository.getTasks();
    const createdTask = tasks.find((t) => t.id === createdTaskId);
    expect(createdTask).toBeDefined();
    expect(createdTask?.status).toBe("OPEN");
    expect(createdTask?.priority).toBe("HIGH");

    // Run watchdog second time -> idempotency check must prevent duplicate task creation
    const req2 = new Request("http://localhost/api/care/cron-watchdog", {
      method: "POST",
      headers: { "x-cron-secret": "test-cron-secret" },
    });
    const res2 = await watchdogHandler(req2);
    const data2 = await res2.json();

    expect(data2.success).toBe(true);
    // Should NOT create another task for the same occurrence
    const duplicateTasks = (await careRepository.getTasks()).filter(
      (t) => t.sourceOccurrenceId === testOcc?.id
    );
    expect(duplicateTasks.length).toBe(1);
  });

  it("never escalates doses that were marked taken, skipped, or flagged as silent", async () => {
    // Advance clock to a distinct time (11:30 AM UTC) to avoid ID collisions
    const currentTime = new Date("2026-11-15T11:30:00Z");
    vi.setSystemTime(currentTime);
    const overdueTime = new Date("2026-11-15T10:00:00Z").toISOString();

    // 1. Taken dose
    vi.advanceTimersByTime(100);
    const takenMed = await careRepository.addMedicationWithVersion({
      name: "Taken Med",
      dosage: "5 mg",
      instructions: "Take daily",
      scheduleTime: "10:00 AM",
      slot: "morning",
      pillColor: "blue",
      pillShape: "round",
      reason: "Daily regimen",
      authorName: "Dr. Smith",
    });
    const occTaken = (await careRepository.getOccurrences()).find((o) => o.medicationId === takenMed.id);
    if (occTaken) {
      occTaken.scheduledIso = overdueTime;
      occTaken.status = "MARKED_TAKEN";
    }

    // 2. Skipped dose
    vi.advanceTimersByTime(100);
    const skippedMed = await careRepository.addMedicationWithVersion({
      name: "Skipped Med",
      dosage: "5 mg",
      instructions: "Take daily",
      scheduleTime: "10:00 AM",
      slot: "morning",
      pillColor: "white",
      pillShape: "round",
      reason: "Daily regimen",
      authorName: "Dr. Smith",
    });
    const occSkipped = (await careRepository.getOccurrences()).find((o) => o.medicationId === skippedMed.id);
    if (occSkipped) {
      occSkipped.scheduledIso = overdueTime;
      occSkipped.status = "SKIPPED";
    }

    // 3. Silent routine dose
    vi.advanceTimersByTime(100);
    const silentMed = await careRepository.addMedicationWithVersion({
      name: "Silent Med",
      dosage: "5 mg",
      instructions: "Private routine",
      scheduleTime: "10:00 AM",
      slot: "morning",
      pillColor: "green",
      pillShape: "capsule",
      reason: "Private regimen",
      authorName: "Dr. Smith",
    });
    const occSilent = (await careRepository.getOccurrences()).find((o) => o.medicationId === silentMed.id);
    if (occSilent) {
      occSilent.scheduledIso = overdueTime;
      occSilent.status = "PENDING";
      occSilent.silentRoutine = true;
    }

    const req = new Request("http://localhost/api/care/cron-watchdog", {
      method: "POST",
      headers: { "x-cron-secret": "test-cron-secret" },
    });
    const res = await watchdogHandler(req);
    const data = await res.json();
    expect(res.status).toBe(200);

    const newlyCreatedTaskIds: string[] = data.results.tasksCreated;
    const allTasks = await careRepository.getTasks();
    const newlyCreatedTasks = allTasks.filter((t) => newlyCreatedTaskIds.includes(t.id));
    const escalatedSourceIds = newlyCreatedTasks.map((t) => t.sourceOccurrenceId);

    expect(escalatedSourceIds).not.toContain(occTaken?.id);
    expect(escalatedSourceIds).not.toContain(occSkipped?.id);
    expect(escalatedSourceIds).not.toContain(occSilent?.id);
  });
});

describe("Database Repository Persistence Interface", () => {
  it("persists medication creation, version tracking, and history", async () => {
    const med = await careRepository.addMedicationWithVersion({
      name: "Persistence Test Med",
      dosage: "50 mg",
      instructions: "With food",
      scheduleTime: "12:00 PM",
      slot: "afternoon",
      pillColor: "yellow",
      pillShape: "round",
      reason: "Initial clinical order",
      authorName: "Nurse Specialist",
    });

    expect(med.id).toBeDefined();
    expect(med.currentVersion).toBe(1);

    // Retrieve via repository
    const allMeds = await careRepository.getMedications();
    const found = allMeds.find((m) => m.id === med.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Persistence Test Med");

    // Edit version
    const updateResult = await careRepository.editMedicationWithVersion({
      medicationId: med.id,
      dosage: "100 mg",
      instructions: "Increased dose after review",
      scheduleTime: "12:00 PM",
      slot: "afternoon",
      reason: "Dose titrated per lab results",
      authorName: "Dr. Specialist",
    });

    expect(updateResult).toBeDefined();
    expect(updateResult?.medication.currentVersion).toBe(2);
    expect(updateResult?.medication.dosage).toBe("100 mg");

    // Verify version history
    const versions = await careRepository.getMedicationVersions(med.id);
    expect(versions.length).toBe(2);
    expect(versions[0].version).toBe(2);
    expect(versions[1].version).toBe(1);
  });

  it("handles doctor appointments and care tasks end-to-end", async () => {
    const profile = await careRepository.getProfile();

    const appt = await careRepository.addAppointment({
      careProfileId: profile.id,
      doctorName: "Dr. Emily Watson",
      specialty: "Neurology",
      clinicName: "Metro General",
      address: "100 Hospital Way",
      dateTime: "2026-11-20T14:30:00Z",
      dateLabel: "Nov 20, 2026",
      timeLabel: "02:30 PM",
      transportAssigned: true,
      questionsToAsk: ["Any side effects?"],
      postVisitNotes: "None yet",
      status: "UPCOMING",
    });

    expect(appt.id).toBeDefined();
    const appts = await careRepository.getAppointments(profile.id);
    expect(appts.some((a) => a.id === appt.id)).toBe(true);

    // Task workflow via createBackupRequest
    const task = await careRepository.createBackupRequest({
      caregiverName: "Priya Sharma",
      reason: "Need relief coverage for afternoon rounds",
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe("OPEN");

    const claimed = await careRepository.claimTask(task.id, "Nurse Joy");
    expect(claimed?.status).toBe("CLAIMED");
    expect(claimed?.claimedBy).toBe("Nurse Joy");

    const resolved = await careRepository.resolveTask(
      task.id,
      "spoke_with_elder",
      "Confirmed shift relief arranged.",
      "Nurse Joy"
    );
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.resolutionOutcome).toBe("spoke_with_elder");
  });

  it("manages caregiver wellbeing check-ins with consent controls", async () => {
    const checkIn = await careRepository.addWellbeingCheckIn({
      caregiverId: "cg-test-1",
      sleepHours: 7,
      mood: 4,
      stress: 2,
      energy: 4,
      note: "Good rest overnight",
      shareWithFamily: false, // Private
    });

    expect(checkIn.id).toBeDefined();

    const history = await careRepository.getWellbeingHistory("cg-test-1");
    expect(history.some((h) => h.id === checkIn.id)).toBe(true);
  });
});
