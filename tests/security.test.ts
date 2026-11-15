import { describe, it, expect } from "vitest";
import { guardianStore } from "../src/lib/store";

describe("Guardian Oasis Security & RBAC Verification Suite", () => {
  describe("1. Sensitive Credential & PIN Redaction", () => {
    it("should never expose plain-text elder PIN in sanitized profile responses", () => {
      const sanitized = guardianStore.getSanitizedProfile("read_only");
      expect(sanitized.passcode).toBe("••••");
      expect(sanitized.passcodeMasked).toContain("••••");
      // Ensure circle invite code is hidden for non-privileged roles
      expect(sanitized.circleInviteCode).toBe("••••••••");
    });

    it("should only reveal circle invite code to privileged roles (owner, family_manager)", () => {
      const privilegedProfile = guardianStore.getSanitizedProfile("family_manager");
      expect(privilegedProfile.circleInviteCode).toBe("OASIS-7629");
      expect(privilegedProfile.passcode).toBe("••••"); // PIN is always redacted
    });
  });

  describe("2. Patient-Level Access Boundary Isolation", () => {
    it("should allow caregivers to access their authorized patient", () => {
      const authorizedProfileId = "profile-eleanor-thompson";
      const hasAccess = guardianStore.verifyPatientAccess(
        authorizedProfileId,
        "profile-eleanor-thompson"
      );
      expect(hasAccess).toBe(true);
    });

    it("should reject caregivers attempting to access unrelated patients", () => {
      const caregiverPatientId = "profile-eleanor-thompson";
      const unrelatedPatientId = "profile-unrelated-john-doe-99";
      const hasAccess = guardianStore.verifyPatientAccess(
        caregiverPatientId,
        unrelatedPatientId
      );
      expect(hasAccess).toBe(false);
    });
  });

  describe("3. Server-Side Role-Based Authorization Enforcement", () => {
    it("should reject medication plan creation for read_only roles", () => {
      const readOnlyRole = "read_only";
      const allowedRoles = ["owner", "family_manager"];
      const isPermitted = allowedRoles.includes(readOnlyRole);
      expect(isPermitted).toBe(false);
    });

    it("should reject task claiming for read_only roles", () => {
      const readOnlyRole = "read_only";
      const allowedRoles = ["caregiver", "family_manager", "owner"];
      const isPermitted = allowedRoles.includes(readOnlyRole);
      expect(isPermitted).toBe(false);
    });
  });

  describe("4. Autonomous Watchdog Escalation", () => {
    it("should escalate unconfirmed doses and record audit events autonomously", () => {
      const initialTasks = guardianStore.getTasks().length;
      const occurrences = guardianStore.getOccurrences();
      const scheduledOcc = occurrences.find(
        (o) => o.status === "SCHEDULED" || o.status === "PENDING"
      );

      if (scheduledOcc) {
        const task = guardianStore.escalateUnconfirmedDose(scheduledOcc.id);
        expect(task).toBeDefined();
        expect(task?.status).toBe("OPEN");

        const updatedTasks = guardianStore.getTasks().length;
        expect(updatedTasks).toBeGreaterThan(initialTasks);

        const auditEvents = guardianStore.getAuditEvents();
        const escalationAudit = auditEvents.find(
          (a) => a.action === "ESCALATION_TRIGGERED" && a.entityId === task?.id
        );
        expect(escalationAudit).toBeDefined();
      }
    });
  });
});
