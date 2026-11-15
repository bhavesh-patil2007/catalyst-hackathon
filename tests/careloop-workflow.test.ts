import { describe, it, expect } from "vitest";
import { guardianStore } from "../src/lib/store";
import { dispatchProactiveEmail } from "../src/lib/notificationService";

describe("Critical End-to-End CareLoop Workflow Verification", () => {
  it("executes the full lifecycle: Family creates medication -> Scheduled reminder -> Senior missed dose -> CareLoop escalation -> Caregiver claim & resolve -> Timeline audit update", async () => {
    // ----------------------------------------------------
    // STEP 1: Family Manager creates new medication with clinical version guard
    // ----------------------------------------------------
    const createdMed = guardianStore.addMedicationWithVersion({
      name: "Amlodipine Besylate",
      dosage: "5 mg",
      instructions: "Take once daily in the morning with water.",
      scheduleTime: "08:15 AM",
      slot: "morning",
      pillColor: "emerald",
      pillShape: "round",
      reason: "Added by Dr. Robert Vance for secondary hypertension control",
      authorName: "Sarah Thompson (Family Manager)",
    });

    expect(createdMed).toBeDefined();
    expect(createdMed.name).toBe("Amlodipine Besylate");
    expect(createdMed.currentVersion).toBe(1);

    // ----------------------------------------------------
    // STEP 2: Verify scheduled dose occurrence created for Today
    // ----------------------------------------------------
    const occurrences = guardianStore.getOccurrences();
    const doseOccurrence = occurrences.find((o) => o.medicationId === createdMed.id);
    expect(doseOccurrence).toBeDefined();
    expect(doseOccurrence?.status).toBe("SCHEDULED");
    expect(doseOccurrence?.scheduledTime).toBe("08:15 AM");

    // ----------------------------------------------------
    // STEP 3: Proactive Notification Dispatch (Truthful delivery behavior)
    // ----------------------------------------------------
    const dedupeKey = `dose-due-${doseOccurrence?.id}-${new Date().toISOString().slice(0, 10)}`;
    const notificationResult = await dispatchProactiveEmail({
      dedupeKey,
      recipientEmail: "eleanor.thompson.care@demo.local",
      recipientRole: "Older Adult",
      type: "DOSE_DUE",
      subject: `Medication Reminder: ${createdMed.name} 5 mg`,
      htmlContent: `<p>Please take your morning dose of ${createdMed.name}.</p>`,
      bodyPreview: `Scheduled 8:15 AM routine for ${createdMed.name}`,
    });

    // Validates deduplication and truthful status (CONFIG_REQUIRED when no API key)
    expect(["DELIVERED", "CONFIG_REQUIRED"]).toContain(notificationResult.status);

    // Assert duplicate suppression works
    const duplicateAttempt = await dispatchProactiveEmail({
      dedupeKey,
      recipientEmail: "eleanor.thompson.care@demo.local",
      recipientRole: "Older Adult",
      type: "DOSE_DUE",
      subject: `Medication Reminder: ${createdMed.name} 5 mg`,
      htmlContent: `<p>Duplicate</p>`,
      bodyPreview: `Duplicate`,
    });
    expect(duplicateAttempt.deduplicated).toBe(true);
    expect(duplicateAttempt.status).toBe("SUPPRESSED");

    // ----------------------------------------------------
    // STEP 4: Senior misses the dose -> Autonomous CareLoop Escalation triggers
    // ----------------------------------------------------
    const escalatedTask = guardianStore.escalateUnconfirmedDose(doseOccurrence!.id);
    expect(escalatedTask).toBeDefined();
    expect(escalatedTask?.status).toBe("OPEN");
    expect(escalatedTask?.medicationName).toBe("Amlodipine Besylate");
    expect(escalatedTask?.priority).toBe("HIGH");

    // ----------------------------------------------------
    // STEP 5: Caregiver Priya Sharma claims the follow-up task
    // ----------------------------------------------------
    const claimedTask = guardianStore.claimTask(escalatedTask!.id, "Priya Sharma, RN");
    expect(claimedTask).toBeDefined();
    expect(claimedTask?.status).toBe("CLAIMED");
    expect(claimedTask?.claimedBy).toBe("Priya Sharma, RN");

    // ----------------------------------------------------
    // STEP 6: Caregiver records resolution outcome
    // ----------------------------------------------------
    const resolvedTask = guardianStore.resolveTask(
      escalatedTask!.id,
      "spoke_with_elder",
      "Called Eleanor by phone. She confirmed she was in the garden and took her 5mg Amlodipine tablet with herbal tea.",
      "Priya Sharma, RN"
    );
    expect(resolvedTask).toBeDefined();
    expect(resolvedTask?.status).toBe("RESOLVED");
    expect(resolvedTask?.resolutionOutcome).toBe("spoke_with_elder");
    expect(resolvedTask?.resolutionNote).toContain("Eleanor by phone");

    // ----------------------------------------------------
    // STEP 7: Family modifies medication dosage with Version Guard increment
    // ----------------------------------------------------
    const updateResult = guardianStore.editMedicationWithVersion({
      medicationId: createdMed.id,
      dosage: "10 mg",
      instructions: "Increased dosage. Take with breakfast.",
      scheduleTime: "08:30 AM",
      reason: "Cardiologist Dr. Vance doubled dosage to 10mg after review of 2-week blood pressure log",
      authorName: "Sarah Thompson (Family Manager)",
    });

    expect(updateResult).toBeDefined();
    expect(updateResult?.medication.currentVersion).toBe(2);
    expect(updateResult?.version.version).toBe(2);
    expect(updateResult?.version.doseText).toBe("10 mg");

    // ----------------------------------------------------
    // STEP 8: Shared Care Timeline contains immutable audit events for every step
    // ----------------------------------------------------
    const auditEvents = guardianStore.getAuditEvents();
    const creationAudit = auditEvents.find(
      (a) => a.action === "MEDICATION_CREATED" && a.entityId === createdMed.id
    );
    const escalationAudit = auditEvents.find(
      (a) => a.action === "ESCALATION_TRIGGERED" && a.entityId === escalatedTask?.id
    );
    const claimAudit = auditEvents.find(
      (a) => a.action === "TASK_CLAIMED" && a.entityId === escalatedTask?.id
    );
    const resolveAudit = auditEvents.find(
      (a) => a.action === "TASK_RESOLVED" && a.entityId === escalatedTask?.id
    );
    const versionAudit = auditEvents.find(
      (a) => a.action === "MEDICATION_UPDATED" && a.entityId === createdMed.id
    );

    expect(creationAudit).toBeDefined();
    expect(escalationAudit).toBeDefined();
    expect(claimAudit).toBeDefined();
    expect(resolveAudit).toBeDefined();
    expect(versionAudit).toBeDefined();
  });
});
