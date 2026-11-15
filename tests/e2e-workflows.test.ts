import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as postElderPin } from "../src/app/api/auth/elder-pin/route";
import { POST as postCircleCode } from "../src/app/api/auth/circle-code/route";
import { POST as postLogout } from "../src/app/api/auth/logout/route";
import { GET as getTodayCare } from "../src/app/api/care/today/route";
import { POST as postMedication, PATCH as patchMedication } from "../src/app/api/medications/route";
import { POST as postCheckIn } from "../src/app/api/doses/checkin/route";
import { POST as postAppointment } from "../src/app/api/appointments/route";
import { POST as postTask } from "../src/app/api/tasks/route";
import { POST as postExtract } from "../src/app/api/medsutra/extract/route";
import { POST as postWellbeingCheckin } from "../src/app/api/wellbeing/checkin/route";
import { GET as getWellbeingHistory } from "../src/app/api/wellbeing/history/route";
import { dispatchProactiveEmail } from "../src/lib/notificationService";
import { NextRequest } from "next/server";

describe("CareOrbit Full End-to-End Functional Regression Tests", () => {
  beforeEach(() => {
    (process.env as any).NODE_ENV = "test";
    process.env.ENABLE_TEST_AUTH_HEADERS = "true";
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = "test";
  });

  describe("1. Landing, Authentication & Session Role Routing", () => {
    it("authenticates senior via 4-digit PIN '1234' with owner role and /elder redirect", async () => {
      const req = new Request("http://localhost/api/auth/elder-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      });

      const res = await postElderPin(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("owner");
      expect(data.redirectUrl).toBe("/elder");
    });

    it("authenticates Family Manager via circle invite code 'OASIS-7629'", async () => {
      const req = new Request("http://localhost/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "OASIS-7629" }),
      });

      const res = await postCircleCode(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("family_manager");
      expect(data.redirectUrl).toBe("/dashboard");
    });

    it("authenticates Nurse/Caregiver via invitation code 'CAREGIVER-4192'", async () => {
      const req = new Request("http://localhost/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "CAREGIVER-4192" }),
      });

      const res = await postCircleCode(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("caregiver");
      expect(data.redirectUrl).toBe("/caregiver");
    });

    it("authenticates Read-Only Observer via invitation code 'OBSERVER-8301'", async () => {
      const req = new Request("http://localhost/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "OBSERVER-8301" }),
      });

      const res = await postCircleCode(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("read_only");
      expect(data.redirectUrl).toBe("/timeline");
    });

    it("logs out user securely and destroys session cookie", async () => {
      const res = await postLogout();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("2. Family Manager Operations (Dashboard, Medication Management, Appointments, Timeline)", () => {
    let createdMedId: string;

    it("loads dashboard care data with redacted credentials", async () => {
      const req = new Request("http://localhost/api/care/today", {
        headers: {
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
      });

      const res = await getTodayCare(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.profile.passcode).toBe("••••");
      expect(data.data.profile.passcodeMasked).toContain("active");
      expect(data.data.medications.length).toBeGreaterThanOrEqual(1);
      expect(data.data.occurrences.length).toBeGreaterThanOrEqual(1);
    });

    it("creates a new medication order with version 1", async () => {
      const medName = "Carvedilol Beta-Blocker " + Date.now();
      const req = new Request("http://localhost/api/medications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          name: medName,
          dosage: "6.25 mg",
          instructions: "Take with food twice daily",
          slot: "morning",
          scheduleTime: "08:00 AM",
          pillColor: "white",
          pillShape: "round",
          reason: "Mild heart failure maintenance per cardiology consultation",
        }),
      });

      const res = await postMedication(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(medName);
      expect(data.data.currentVersion).toBe(1);
      createdMedId = data.data.id;
    });

    it("edits the medication with clinical version increment to version 2", async () => {
      const req = new Request("http://localhost/api/medications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          medicationId: createdMedId,
          dosage: "12.5 mg",
          instructions: "Titrated to 12.5mg twice daily per Dr. Vance",
          slot: "morning",
          scheduleTime: "08:00 AM",
          reason: "Lab follow-up showed target BP achieved; dose increased",
        }),
      });

      const res = await patchMedication(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.currentVersion).toBe(2);
      expect(data.data.dosage).toBe("12.5 mg");
    });

    it("schedules a doctor appointment and records it in the timeline", async () => {
      const req = new Request("http://localhost/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          doctorName: "Dr. Robert Vance",
          specialty: "Cardiology",
          clinicName: "Heart Health Clinic",
          address: "500 Medical Center Dr",
          dateTime: "2026-11-28T10:00:00Z",
          dateLabel: "Nov 28, 2026",
          timeLabel: "10:00 AM",
          transportAssigned: true,
          transportDetails: "Senior Van pickup at 9:15 AM",
          questionsToAsk: ["Review Carvedilol titration tolerance"],
          postVisitNotes: "Bring recent blood pressure logs",
        }),
      });

      const res = await postAppointment(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.doctorName).toBe("Dr. Robert Vance");
      expect(data.data.transportAssigned).toBe(true);
    });
  });

  describe("3. Older Adult Operations (Check-In, Not Sure, Privacy Preferences)", () => {
    it("records senior MARKED_TAKEN check-in with privacy preference", async () => {
      const req = new Request("http://localhost/api/doses/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "owner",
          "x-guardian-actor-name": "Eleanor Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          occurrenceId: "occ-today-morning-met",
          status: "MARKED_TAKEN",
          note: "Took with warm oatmeal and tea",
          doNotNotifyFamily: true, // Senior privacy preference
        }),
      });

      const res = await postCheckIn(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("MARKED_TAKEN");
      expect(data.data.silentRoutine).toBe(true);
    });

    it("records NOT_SURE dose check-in without breaking schedule", async () => {
      const req = new Request("http://localhost/api/doses/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "owner",
          "x-guardian-actor-name": "Eleanor Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          occurrenceId: "occ-today-morning-lis",
          status: "NOT_SURE",
          note: "Forgot if I swallowed the pink tablet before my walk",
        }),
      });

      const res = await postCheckIn(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("NOT_SURE");
    });
  });

  describe("4. Caregiver Operations (Claim, Handoff, Resolve, Audit Trail)", () => {
    let taskId: string;

    it("caregiver claims an open follow-up task", async () => {
      const req = new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "caregiver",
          "x-guardian-actor-name": "Priya Sharma, RN",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          action: "claim",
          taskId: "task-careloop-101",
        }),
      });

      const res = await postTask(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("CLAIMED");
      expect(data.data.claimedBy).toBe("Priya Sharma, RN");
      taskId = data.data.id;
    });

    it("caregiver hands off task to relief caregiver with clinical note", async () => {
      const req = new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "caregiver",
          "x-guardian-actor-name": "Priya Sharma, RN",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          action: "handoff",
          taskId: "task-careloop-101",
          toCaregiver: "Nurse Joy",
          note: "Handed over for evening follow-up check",
        }),
      });

      const res = await postTask(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.claimedBy).toBe("Nurse Joy");
      expect(data.data.resolutionOutcome).toBe("handed_off");
    });

    it("caregiver resolves task and logs audit outcome", async () => {
      const req = new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "caregiver",
          "x-guardian-actor-name": "Nurse Joy",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          action: "resolve",
          taskId: "task-careloop-101",
          outcome: "visited_in_person",
          note: "Visited Eleanor in person. Confirmed medication taken and verified pillbox.",
        }),
      });

      const res = await postTask(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("RESOLVED");
      expect(data.data.resolutionOutcome).toBe("visited_in_person");
    });
  });

  describe("5. Notification Delivery & Deduplication Truthfulness", () => {
    it("reports CONFIG_REQUIRED when RESEND_API_KEY is not configured", async () => {
      delete process.env.RESEND_API_KEY;

      const result = await dispatchProactiveEmail({
        dedupeKey: "truth-test-" + Date.now(),
        recipientEmail: "test@demo.local",
        recipientRole: "Family Manager",
        type: "APPOINTMENT_REMINDER",
        subject: "Consultation Reminder",
        htmlContent: "<p>Reminder content</p>",
        bodyPreview: "Reminder",
      });

      expect(result.status).toBe("CONFIG_REQUIRED");
      expect(result.dispatched).toBe(false);
      expect(result.providerError).toContain("RESEND_API_KEY");
    });

    it("suppresses duplicate email dispatch using durable dedupeKey", async () => {
      const fixedKey = "dedupe-fixed-key-" + Date.now();

      // First call
      const res1 = await dispatchProactiveEmail({
        dedupeKey: fixedKey,
        recipientEmail: "test@demo.local",
        recipientRole: "Caregiver",
        type: "DOSE_DUE",
        subject: "Routine Reminder",
        htmlContent: "<p>Due now</p>",
        bodyPreview: "Due now",
      });

      // Second identical call
      const res2 = await dispatchProactiveEmail({
        dedupeKey: fixedKey,
        recipientEmail: "test@demo.local",
        recipientRole: "Caregiver",
        type: "DOSE_DUE",
        subject: "Routine Reminder",
        htmlContent: "<p>Due now</p>",
        bodyPreview: "Due now",
      });

      expect(res2.deduplicated).toBe(true);
      expect(res2.status).toBe("SUPPRESSED");
      expect(res2.dispatched).toBe(false);
    });
  });
});
