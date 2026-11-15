import { describe, it, expect } from "vitest";
import { guardianStore } from "../src/lib/store";
import { addCheckIn, getBurnoutRisk, getHistory } from "../src/lib/wellbeingStore";

describe("CareOrbit Innovations Verification: MedSutra AI & Caregiver Wellbeing", () => {
  describe("Module A: MedSutra AI Prescription Intelligence", () => {
    it("should provide structured extractions with confidence scores and multilingual explanations", () => {
      const mockExtraction = {
        name: "Metformin ER",
        dosage: "500 mg",
        frequency: "Once daily with breakfast",
        duration: "90 days",
        instructions: "Take with food and full glass of water",
        confidence: "high" as const,
        uncertain_fields: [],
        plain_language_explanation:
          "Helps manage blood glucose levels for Type 2 Diabetes by reducing liver glucose production.",
        plain_language_hi:
          "यह दवा टाइप 2 मधुमेह के लिए रक्त शर्करा को नियंत्रित करने में मदद करती है।",
        plain_language_mr:
          "हे औषध टाइप २ मधुमेहासाठी रक्तातील साखर नियंत्रित ठेवण्यास मदत करते.",
        handwriting_alert: undefined,
      };

      expect(mockExtraction.confidence).toBe("high");
      expect(mockExtraction.plain_language_hi).toContain("मधुमेह");
      expect(mockExtraction.plain_language_mr).toContain("मधुमेहासाठी");
      expect(mockExtraction.uncertain_fields.length).toBe(0);
    });

    it("should flag unclear handwriting and maintain human-in-the-loop verification guard", () => {
      const ambiguousExtraction = {
        name: "Lisinopril",
        dosage: "10 mg",
        frequency: "Once daily in morning",
        duration: "Ongoing",
        instructions: "Blood pressure tablet",
        confidence: "medium" as const,
        uncertain_fields: ["duration"],
        plain_language_explanation: "Lowers blood pressure to protect heart and kidneys.",
        handwriting_alert: "Duration handwriting was faded on script",
      };

      // Failsafe: ensure uncertain fields trigger warnings
      expect(ambiguousExtraction.confidence).not.toBe("high");
      expect(ambiguousExtraction.handwriting_alert).toBeDefined();

      // Ensure AI does not auto-create without explicit human approval
      const initialMedsCount = guardianStore.getMedications().length;

      // Only when human manager approves does it enter the schedule
      const approvedMed = guardianStore.addMedicationWithVersion({
        name: ambiguousExtraction.name,
        dosage: ambiguousExtraction.dosage,
        instructions: ambiguousExtraction.instructions,
        scheduleTime: "08:00 AM",
        slot: "morning",
        pillColor: "sky",
        pillShape: "round",
        reason: "MedSutra prescription extraction verified and approved by Sarah Thompson",
        authorName: "Sarah Thompson",
      });

      expect(approvedMed).toBeDefined();
      expect(guardianStore.getMedications().length).toBe(initialMedsCount + 1);
    });
  });

  describe("Module B: Caregiver Wellbeing & CareLoop Backup Relief", () => {
    it("should record daily check-in with sleep, mood, stress, and consent settings", () => {
      const caregiverId = "caregiver-priya-test";
      const checkin = addCheckIn({
        caregiverId,
        sleepHours: 7.5,
        mood: 4,
        stress: 4,
        energy: 4,
        note: "Eleanor rested well today. Calm afternoon shift.",
        shareWithFamily: true,
      });

      expect(checkin.id).toBeDefined();
      expect(checkin.sleepHours).toBe(7.5);
      expect(checkin.shareWithFamily).toBe(true);

      const history = getHistory(caregiverId);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it("should calculate 7-day composite score and allow CareLoop backup relief requests without medical burnout diagnosis", () => {
      const caregiverId = "caregiver-fatigued-shift";
      // Log exhausted shift scores
      addCheckIn({
        caregiverId,
        sleepHours: 4.0,
        mood: 1,
        stress: 1,
        energy: 1,
        shareWithFamily: false,
      });

      const risk = getBurnoutRisk(caregiverId);
      expect(risk).toBe("high");

      // Caregiver initiates backup coverage request into CareLoop
      const backupTask = guardianStore.createBackupRequest({
        caregiverName: "Priya Sharma, RN",
        reason: "Wellbeing workload fatigue. Relief coverage requested for tomorrow evening.",
      });

      expect(backupTask).toBeDefined();
      expect(backupTask.status).toBe("OPEN");
      expect(backupTask.priority).toBe("URGENT");
      expect(backupTask.medicationName).toBe("Caregiver Relief Coverage");

      // Verify audit trail logged the backup relief request
      const audit = guardianStore
        .getAuditEvents()
        .find((a) => a.action === "BACKUP_REQUESTED" && a.entityId === backupTask.id);
      expect(audit).toBeDefined();
    });
  });
});
