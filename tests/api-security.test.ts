import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as getTodayCare } from "../src/app/api/care/today/route";
import { GET as getWatchdog, POST as postWatchdog } from "../src/app/api/care/cron-watchdog/route";
import { POST as postElderPin } from "../src/app/api/auth/elder-pin/route";
import { POST as postCircleCode } from "../src/app/api/auth/circle-code/route";
import { POST as postLogout } from "../src/app/api/auth/logout/route";
import { POST as postTestEmail } from "../src/app/api/notifications/test-email/route";
import { POST as postAppointmentReminder } from "../src/app/api/notifications/appointment-reminder/route";
import { POST as postMedication } from "../src/app/api/medications/route";
import { isValidFileSignature } from "../src/lib/fileValidation";
import { getActorFromSessionOrHeader } from "../src/lib/authGuard";
import { getSessionSecret } from "../src/lib/session";
import { maskEmail, dispatchProactiveEmail } from "../src/lib/notificationService";
import { addCheckIn, clearCheckInsForTesting } from "../src/lib/wellbeingStore";
import { GET as getWellbeingHistory } from "../src/app/api/wellbeing/history/route";
import { NextRequest } from "next/server";

describe("CareOrbit Production Hardening & Route Security Tests", () => {
  beforeEach(() => {
    (process.env as any).NODE_ENV = "test";
    process.env.ENABLE_TEST_AUTH_HEADERS = "true";
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = "test";
    delete process.env.CRON_SECRET;
  });

  describe("1. Sensitive Healthcare Route Authentication (/api/care/today)", () => {
    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      // In production mode without session
      (process.env as any).NODE_ENV = "production";
      const request = new Request("http://localhost:3000/api/care/today", {
        method: "GET",
      });

      const response = await getTodayCare(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });
  });

  describe("2. Client-Supplied Header Forgery Prevention", () => {
    it("must reject forged x-guardian-role headers when NODE_ENV is production", async () => {
      (process.env as any).NODE_ENV = "production";

      const forgedRequest = new Request("http://localhost:3000/api/medications", {
        method: "POST",
        headers: {
          "x-guardian-role": "owner",
          "x-guardian-profile-id": "profile-eleanor-thompson",
          "x-guardian-actor-name": "Attacker",
        },
      });

      const result = await getActorFromSessionOrHeader(forgedRequest, ["owner", "family_manager"]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(401);
      }
    });
  });

  describe("3. Production Demo Credential Rejection", () => {
    it("should reject hardcoded elder PIN '1234' in production", async () => {
      (process.env as any).NODE_ENV = "production";

      const request = new Request("http://localhost:3000/api/auth/elder-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      });

      const response = await postElderPin(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Demo credentials are strictly prohibited in production");
    });

    it("should reject hardcoded circle code 'OASIS-7629' in production", async () => {
      (process.env as any).NODE_ENV = "production";

      const request = new Request("http://localhost:3000/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "OASIS-7629" }),
      });

      const response = await postCircleCode(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Demo invite codes are strictly prohibited in production");
    });
  });

  describe("4. Role-Specific Server-Side Circle Invitation Verification", () => {
    it("should authenticate valid elder PIN and redirect to /elder", async () => {
      const request = new Request("http://localhost:3000/api/auth/elder-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      });

      const response = await postElderPin(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("owner");
      expect(data.redirectUrl).toBe("/elder");
    });

    it("should reject invalid elder PIN", async () => {
      const request = new Request("http://localhost:3000/api/auth/elder-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "9999" }),
      });

      const response = await postElderPin(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Incorrect PIN");
    });

    it("should assign family_manager role and redirect to /dashboard for OASIS-7629", async () => {
      const request = new Request("http://localhost:3000/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "OASIS-7629", name: "Sarah Thompson" }),
      });

      const response = await postCircleCode(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("family_manager");
      expect(data.redirectUrl).toBe("/dashboard");
    });

    it("should assign caregiver role and redirect to /caregiver for CAREGIVER-4192", async () => {
      const request = new Request("http://localhost:3000/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "CAREGIVER-4192", name: "Marcus Rivera" }),
      });

      const response = await postCircleCode(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("caregiver");
      expect(data.redirectUrl).toBe("/caregiver");
    });

    it("should assign read_only role and redirect to /timeline for OBSERVER-8301", async () => {
      const request = new Request("http://localhost:3000/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "OBSERVER-8301", name: "Dr. Observer" }),
      });

      const response = await postCircleCode(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("read_only");
      expect(data.redirectUrl).toBe("/timeline");
    });

    it("should reject invalid circle invite code", async () => {
      const request = new Request("http://localhost:3000/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "INVALID-CODE-999" }),
      });

      const response = await postCircleCode(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid or expired");
    });

    it("should support logout endpoint", async () => {
      const response = await postLogout();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("5. CareLoop Cron Watchdog Protection", () => {
    it("should reject GET requests with 405 Method Not Allowed", async () => {
      const response = await getWatchdog();
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("POST");
    });

    it("should reject POST requests without CRON_SECRET with 401 Unauthorized", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.CRON_SECRET = "super-secret-cron-token-998877";

      const request = new Request("http://localhost:3000/api/care/cron-watchdog", {
        method: "POST",
      });

      const response = await postWatchdog(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Unauthorized");
    });

    it("should accept POST requests with valid CRON_SECRET", async () => {
      process.env.CRON_SECRET = "super-secret-cron-token-998877";

      const request = new Request("http://localhost:3000/api/care/cron-watchdog", {
        method: "POST",
        headers: {
          Authorization: "Bearer super-secret-cron-token-998877",
        },
      });

      const response = await postWatchdog(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.results).toBeDefined();
    });
  });

  describe("6. Notification Route Authentication", () => {
    it("should reject unauthenticated calls to /api/notifications/test-email with 401", async () => {
      (process.env as any).NODE_ENV = "production";
      const request = new Request("http://localhost:3000/api/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: "test@example.com",
          recipientRole: "Family Member",
          type: "DOSE_DUE",
        }),
      });

      const response = await postTestEmail(request);
      expect(response.status).toBe(401);
    });

    it("should reject unauthenticated calls to /api/notifications/appointment-reminder with 401", async () => {
      (process.env as any).NODE_ENV = "production";
      const request = new Request("http://localhost:3000/api/notifications/appointment-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: "appt-dr-vance",
        }),
      });

      const response = await postAppointmentReminder(request);
      expect(response.status).toBe(401);
    });
  });

  describe("7. Role-Based Mutation Guard (Read-Only Restriction)", () => {
    it("should reject medication creation by read_only members with 403 Forbidden", async () => {
      const request = new Request("http://localhost:3000/api/medications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "read_only",
          "x-guardian-actor-name": "Observer",
        },
        body: JSON.stringify({
          name: "Unauthorized Drug",
          dosage: "100 mg",
          instructions: "Take once",
          scheduleTime: "08:00 AM",
          slot: "morning",
          reason: "Unauthorized attempt",
        }),
      });

      const response = await postMedication(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Forbidden");
    });
  });

  describe("8. MedSutra Binary Magic-Byte File Validation", () => {
    it("should accept valid JPEG magic bytes (FF D8 FF)", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const result = isValidFileSignature(jpegBuffer);
      expect(result.valid).toBe(true);
      expect(result.format).toBe("image/jpeg");
    });

    it("should accept valid PNG magic bytes", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = isValidFileSignature(pngBuffer);
      expect(result.valid).toBe(true);
      expect(result.format).toBe("image/png");
    });

    it("should accept valid PDF magic bytes (%PDF)", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
      const result = isValidFileSignature(pdfBuffer);
      expect(result.valid).toBe(true);
      expect(result.format).toBe("application/pdf");
    });

    it("should reject text, script, or executable pretending to be an image", () => {
      const maliciousBuffer = Buffer.from("<?php echo 'malicious'; ?>");
      const result = isValidFileSignature(maliciousBuffer);
      expect(result.valid).toBe(false);
    });
  });

  describe("9. Caregiver Wellbeing Server-Side Privacy Filtering", () => {
    beforeEach(() => {
      clearCheckInsForTesting();
    });

    it("should redact unshared entries when family manager accesses caregiver history", async () => {
      // Add a private entry with shareWithFamily: false
      addCheckIn({
        caregiverId: "Sarah Caregiver",
        sleepHours: 4,
        mood: 2,
        stress: 5,
        energy: 1,
        note: "Extremely exhausted, private caregiver thought",
        shareWithFamily: false,
      });

      // Family Manager queries caregiver history
      const req = new NextRequest(
        "http://localhost:3000/api/wellbeing/history?caregiverId=Sarah%20Caregiver",
        {
          headers: {
            "x-guardian-role": "family_manager",
            "x-guardian-actor-name": "Family Member",
          },
        }
      );

      const res = await getWellbeingHistory(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.privacyEnforced).toBe(true);
      // Entry is strictly redacted because shareWithFamily is false
      expect(data.history).toHaveLength(0);
    });

    it("should allow caregiver to view their own private unshared entries", async () => {
      addCheckIn({
        caregiverId: "Sarah Caregiver",
        sleepHours: 5,
        mood: 3,
        stress: 4,
        energy: 2,
        note: "Personal private reflection",
        shareWithFamily: false,
      });

      // Caregiver queries their own history
      const req = new NextRequest(
        "http://localhost:3000/api/wellbeing/history?caregiverId=Sarah%20Caregiver",
        {
          headers: {
            "x-guardian-role": "caregiver",
            "x-guardian-actor-name": "Sarah Caregiver",
          },
        }
      );

      const res = await getWellbeingHistory(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.privacyEnforced).toBe(false);
      expect(data.history).toHaveLength(1);
      expect(data.history[0].note).toBe("Personal private reflection");
    });
  });

  describe("10. Notification Reliability & PHI Masking", () => {
    it("should mask email addresses to protect PHI in logs", () => {
      expect(maskEmail("sarah.thompson@family.org")).toBe("s***@family.org");
      expect(maskEmail("doctor.jones@clinic.care")).toBe("d***@clinic.care");
    });

    it("should suppress duplicate notifications using durable dedupeKey", async () => {
      const dedupeKey = `test-dedupe-key-${Date.now()}`;
      const firstCall = await dispatchProactiveEmail({
        dedupeKey,
        recipientEmail: "test@example.com",
        recipientRole: "Family Member",
        type: "DOSE_DUE",
        subject: "Test Routine",
        htmlContent: "<p>Test</p>",
        bodyPreview: "Test",
      });

      const secondCall = await dispatchProactiveEmail({
        dedupeKey,
        recipientEmail: "test@example.com",
        recipientRole: "Family Member",
        type: "DOSE_DUE",
        subject: "Test Routine",
        htmlContent: "<p>Test</p>",
        bodyPreview: "Test",
      });

      expect(secondCall.deduplicated).toBe(true);
      expect(secondCall.status).toBe("SUPPRESSED");
      expect(secondCall.dispatched).toBe(false);
    });
  });

  describe("11. Session Secret Enforcement in Production Startup", () => {
    it("should throw a fatal error in production if IRON_SESSION_SECRET is missing", () => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.IRON_SESSION_SECRET;

      expect(() => getSessionSecret()).toThrow(/FATAL: IRON_SESSION_SECRET environment variable is missing/);
    });

    it("should throw a fatal error in production if IRON_SESSION_SECRET is less than 32 characters", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.IRON_SESSION_SECRET = "short-secret-123";

      expect(() => getSessionSecret()).toThrow(/less than 32 characters/);
    });

    it("should return the secret when valid 32+ characters in production", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.IRON_SESSION_SECRET = "production-super-secure-session-secret-at-least-32-chars";

      expect(getSessionSecret()).toBe("production-super-secure-session-secret-at-least-32-chars");
    });
  });
});
