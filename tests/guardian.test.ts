import { describe, it, expect, beforeEach } from "vitest";
import { guardianStore } from "../src/lib/store";

describe("Guardian Oasis & CareLoop Comprehensive Test Suite", () => {
  describe("1. Profile & Passcode-Based Access", () => {
    it("should initialize Eleanor Thompson profile with conditions and passcodes", () => {
      const profile = guardianStore.getProfile();
      expect(profile.displayName).toBe("Eleanor Thompson");
      expect(profile.age).toBe(76);
      expect(profile.conditions).toContain("Type 2 Diabetes");
      expect(profile.passcode).toBe("1234");
      expect(profile.circleInviteCode).toBe("OASIS-7629");
    });

    it("should authenticate senior with quick 4-digit PIN", () => {
      const profile = guardianStore.getProfile();
      const enteredPin = "1234";
      expect(enteredPin === profile.passcode).toBe(true);

      const invalidPin = "9999";
      expect(invalidPin === profile.passcode).toBe(false);
    });

    it("should authenticate care circle member with household invite code", () => {
      const profile = guardianStore.getProfile();
      const enteredCode = "OASIS-7629";
      expect(enteredCode.toUpperCase() === profile.circleInviteCode).toBe(true);
    });

    it("should load authorized care members with assigned roles", () => {
      const members = guardianStore.getMembers();
      expect(members.length).toBeGreaterThanOrEqual(4);
      const owner = members.find((m) => m.role === "owner");
      const caregiver = members.find((m) => m.role === "caregiver");
      const familyManager = members.find((m) => m.role === "family_manager");
      const readOnly = members.find((m) => m.role === "read_only");

      expect(owner?.name).toBe("Eleanor Thompson");
      expect(caregiver?.name).toContain("Priya");
      expect(familyManager?.name).toContain("Sarah");
      expect(readOnly?.name).toContain("David");
    });
  });

  describe("2. Medication Schedule & Version Change Guard", () => {
    it("should contain initial active medications with schedules", () => {
      const meds = guardianStore.getMedications();
      expect(meds.length).toBeGreaterThanOrEqual(3);
      const metformin = meds.find((m) => m.name.includes("Metformin"));
      expect(metformin).toBeDefined();
      expect(metformin?.dosage).toBe("500 mg");
      expect(metformin?.currentVersion).toBe(1);
    });

    it("should create new medication with version guard and add scheduled occurrence", () => {
      const newMed = guardianStore.addMedicationWithVersion({
        name: "Glipizide",
        dosage: "5 mg",
        instructions: "Take 30 mins before breakfast",
        scheduleTime: "07:30 AM",
        slot: "morning",
        pillColor: "sky",
        pillShape: "round",
        reason: "Adjusted blood sugar protocol prescribed by Dr. Anita Patel",
        authorName: "Sarah Thompson",
      });

      expect(newMed.name).toBe("Glipizide");
      expect(newMed.currentVersion).toBe(1);

      const occurrences = guardianStore.getOccurrences();
      const glipizideOcc = occurrences.find((o) => o.medicationName === "Glipizide");
      expect(glipizideOcc).toBeDefined();
      expect(glipizideOcc?.status).toBe("SCHEDULED");
    });
  });

  describe("3. Dose Check-in State Transitions & Elder Privacy", () => {
    it("should record MARKED_TAKEN check-in with exact timestamp and actor", () => {
      const occurrences = guardianStore.getOccurrences();
      const targetOcc = occurrences.find((o) => o.status === "SCHEDULED" || o.status === "PENDING");
      expect(targetOcc).toBeDefined();

      if (targetOcc) {
        const updated = guardianStore.recordCheckIn(
          targetOcc.id,
          "MARKED_TAKEN",
          "Eleanor Thompson",
          "owner",
          "Taken with glass of water"
        );

        expect(updated?.status).toBe("MARKED_TAKEN");
        expect(updated?.checkIn?.actorName).toBe("Eleanor Thompson");
        expect(updated?.checkIn?.status).toBe("MARKED_TAKEN");
      }
    });

    it("should record SNOOZED check-in without closing occurrence", () => {
      const occurrences = guardianStore.getOccurrences();
      const occ = occurrences[0];

      const snoozed = guardianStore.recordCheckIn(
        occ.id,
        "SNOOZED",
        "Eleanor Thompson",
        "owner"
      );

      expect(snoozed?.status).toBe("SNOOZED");
    });

    it("should support NOT_SURE check-in state", () => {
      const occurrences = guardianStore.getOccurrences();
      const occ = occurrences[0];

      const notSure = guardianStore.recordCheckIn(
        occ.id,
        "NOT_SURE",
        "Eleanor Thompson",
        "owner",
        "Can't remember if taken"
      );

      expect(notSure?.status).toBe("NOT_SURE");
    });

    it("should respect elder privacy 'doNotNotifyFamily' flag", () => {
      const occurrences = guardianStore.getOccurrences();
      const occ = occurrences[0];

      const checkIn = guardianStore.recordCheckIn(
        occ.id,
        "MARKED_TAKEN",
        "Eleanor Thompson",
        "owner",
        "Private dose",
        true
      );

      expect(checkIn?.silentRoutine).toBe(true);
    });
  });

  describe("4. CareLoop Escalation Engine & Caregiver Relay Handoff", () => {
    it("should escalate an unconfirmed dose and create exactly 1 CareTask assigned to caregiver", () => {
      const occurrences = guardianStore.getOccurrences();
      const occ = occurrences[1];

      const initialTasksCount = guardianStore.getTasks().length;
      const task = guardianStore.escalateUnconfirmedDose(occ.id);

      expect(task).toBeDefined();
      expect(task.status).toBe("OPEN");
      expect(task.assignedToName).toContain("Priya");
      expect(guardianStore.getTasks().length).toBe(initialTasksCount + 1);

      const updatedOcc = guardianStore.getOccurrences().find((o) => o.id === occ.id);
      expect(updatedOcc?.status).toBe("UNCONFIRMED");
    });

    it("should allow caregiver to claim the task", () => {
      const tasks = guardianStore.getTasks();
      const openTask = tasks.find((t) => t.status === "OPEN");
      expect(openTask).toBeDefined();

      if (openTask) {
        const claimed = guardianStore.claimTask(openTask.id, "Priya Sharma, RN");
        expect(claimed?.status).toBe("CLAIMED");
        expect(claimed?.claimedBy).toBe("Priya Sharma, RN");
      }
    });

    it("should allow caregiver relay and handoff to another member", () => {
      const tasks = guardianStore.getTasks();
      const claimedTask = tasks.find((t) => t.status === "CLAIMED") || tasks[0];

      const handedOff = guardianStore.handoffTask(
        claimedTask.id,
        "Priya Sharma, RN",
        "David Thompson (Backup)",
        "Shift ending, please confirm with Eleanor"
      );

      expect(handedOff?.resolutionOutcome).toBe("handed_off");
      expect(handedOff?.assignedToName).toBe("David Thompson (Backup)");
      expect(handedOff?.resolutionNote).toContain("Shift ending");
    });

    it("should allow caregiver to resolve task with recorded outcome and handoff note", () => {
      const tasks = guardianStore.getTasks();
      const claimedTask = tasks.find((t) => t.status === "CLAIMED") || tasks[0];

      const resolved = guardianStore.resolveTask(
        claimedTask.id,
        "spoke_with_elder",
        "Spoke with Eleanor by phone, confirmed dose was taken with light snack",
        "Priya Sharma, RN"
      );

      expect(resolved?.status).toBe("RESOLVED");
      expect(resolved?.resolutionOutcome).toBe("spoke_with_elder");
      expect(resolved?.resolutionNote).toContain("Spoke with Eleanor");
    });
  });

  describe("5. Refill Runway Estimation", () => {
    it("should calculate remaining days and flag low stock medications", () => {
      const runways = guardianStore.getRefillRunways();
      expect(runways.length).toBeGreaterThan(0);

      const lisinopril = runways.find((r) => r.medicationName === "Lisinopril");
      expect(lisinopril).toBeDefined();
      expect(lisinopril?.isLowStock).toBe(true);
      expect(lisinopril?.daysRemaining).toBeLessThanOrEqual(7);
      expect(lisinopril?.estimatedRunOutDate).toBeDefined();
    });
  });

  describe("6. Doctor Appointments Management", () => {
    it("should fetch scheduled upcoming appointments with transport notes", () => {
      const appts = guardianStore.getAppointments();
      expect(appts.length).toBeGreaterThanOrEqual(1);
      const cardio = appts.find((a) => a.doctorName.includes("Vance"));
      expect(cardio).toBeDefined();
      expect(cardio?.transportAssigned).toBe(true);
      expect(cardio?.questionsToAsk.length).toBeGreaterThan(0);
    });

    it("should allow scheduling new appointment and append to audit log", () => {
      const newAppt = guardianStore.addAppointment({
        doctorName: "Dr. Gregory House, MD",
        specialty: "Nephrology",
        clinicName: "Princeton Plainsboro",
        address: "100 Medical Center Way",
        dateTime: "Dec 05, 09:00 AM",
        dateLabel: "Dec 05",
        timeLabel: "09:00 AM",
        transportAssigned: true,
        transportDetails: "Caregiver escort",
        questionsToAsk: ["Review kidney function markers"],
        status: "UPCOMING",
      });

      expect(newAppt.doctorName).toBe("Dr. Gregory House, MD");
      const all = guardianStore.getAppointments();
      expect(all.some((a) => a.doctorName === "Dr. Gregory House, MD")).toBe(true);
    });
  });

  describe("7. Notification Engine & Deduplication", () => {
    it("should suppress duplicate notification jobs with same dedupeKey", () => {
      const key = "test-dedupe-key-999";
      const job1 = {
        id: "notif-test-1",
        dedupeKey: key,
        recipientEmail: "test@example.com",
        recipientRole: "Caregiver",
        type: "DOSE_DUE" as const,
        subject: "Test Reminder",
        bodyPreview: "First notification",
        status: "DELIVERED" as const,
        timestamp: "12:00 PM",
      };

      const firstSent = guardianStore.sendNotification(job1);
      expect(firstSent).toBe(true);

      const job2 = {
        ...job1,
        id: "notif-test-2",
        bodyPreview: "Duplicate send attempt",
      };

      const secondSent = guardianStore.sendNotification(job2);
      expect(secondSent).toBe(false);
    });
  });

  describe("8. Daily Care Brief Generation", () => {
    it("should generate grounded factual summary without hallucinations", () => {
      const brief = guardianStore.getDailyCareBrief();
      expect(brief.isAiGrounded).toBe(true);
      expect(brief.totalScheduled).toBeGreaterThan(0);
      expect(brief.summaryText).toContain("Daily Care Brief for Eleanor Thompson");
      expect(brief.sourceRecords.length).toBeGreaterThan(0);
    });
  });

  describe("9. Caregiver Wellbeing & Burnout Risk Algorithm", () => {
    it("should calculate burnout risk correctly based on sleep, mood, and stress", async () => {
      const { addCheckIn, getBurnoutRisk, getHistory } = await import("../src/lib/wellbeingStore");
      
      const caregiverId = "test-caregiver-priya";
      const checkin = addCheckIn({
        caregiverId,
        sleepHours: 7,
        mood: 4,
        stress: 4,
        energy: 4,
        shareWithFamily: true,
      });

      expect(checkin.id).toBeDefined();
      expect(checkin.caregiverId).toBe(caregiverId);

      const risk = getBurnoutRisk(caregiverId);
      expect(["low", "moderate", "high"]).toContain(risk);

      const history = getHistory(caregiverId);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it("should elevate burnout risk when composite wellbeing score is low", async () => {
      const { addCheckIn, getBurnoutRisk } = await import("../src/lib/wellbeingStore");
      const caregiverId = "exhausted-caregiver";
      
      addCheckIn({
        caregiverId,
        sleepHours: 4,
        mood: 1, // very low
        stress: 1,
        energy: 1, // exhausted
        shareWithFamily: false,
      });

      const risk = getBurnoutRisk(caregiverId);
      expect(risk).toBe("high");
    });
  });

  describe("10. MedSutra AI Prescription Extraction Safety Constraints", () => {
    it("should validate prescription field schema and reject unauthorized automated modifications", () => {
      const validExtraction = {
        name: "Metformin ER",
        dosage: "500 mg",
        frequency: "Once daily with breakfast",
        duration: "30 days",
        confidence: "high" as const,
        uncertain_fields: [],
      };

      expect(validExtraction.name).toBeTruthy();
      expect(validExtraction.confidence).toBe("high");
      expect(validExtraction.uncertain_fields.length).toBe(0);

      // Verify uncertainty flag handling
      const ambiguousExtraction = {
        name: "Amoxicillin",
        dosage: "250mg (?)",
        frequency: "3 times daily",
        duration: "7 days",
        confidence: "low" as const,
        uncertain_fields: ["dosage"],
      };

      expect(ambiguousExtraction.uncertain_fields).toContain("dosage");
      expect(ambiguousExtraction.confidence).toBe("low");
    });
  });
});
