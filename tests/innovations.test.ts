import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as extractHandler } from "../src/app/api/medsutra/extract/route";
import { POST as createMedHandler } from "../src/app/api/medications/route";
import { POST as checkinHandler } from "../src/app/api/wellbeing/checkin/route";
import { GET as historyHandler } from "../src/app/api/wellbeing/history/route";
import { POST as taskHandler } from "../src/app/api/tasks/route";
import { NextRequest } from "next/server";

describe("CareOrbit Innovations Verification: MedSutra AI & Caregiver Wellbeing", () => {
  beforeEach(() => {
    (process.env as any).NODE_ENV = "test";
    process.env.ENABLE_TEST_AUTH_HEADERS = "true";
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = "test";
  });

  describe("Module A: MedSutra AI Prescription Intelligence", () => {
    it("rejects unauthenticated extraction requests", async () => {
      delete process.env.ENABLE_TEST_AUTH_HEADERS;
      const formData = new FormData();
      const req = new NextRequest("http://localhost/api/medsutra/extract", {
        method: "POST",
        body: formData,
      });

      const res = await extractHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      process.env.ENABLE_TEST_AUTH_HEADERS = "true";
    });

    it("rejects malicious or invalid file uploads (unsupported extension and fake signature)", async () => {
      const fakeExecutable = new Blob([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], {
        type: "application/x-msdownload",
      });
      const formData = new FormData();
      formData.append("prescription", fakeExecutable, "malicious.exe");

      const req = new NextRequest("http://localhost/api/medsutra/extract", {
        method: "POST",
        body: formData,
        headers: {
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
      });

      const res = await extractHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid file extension");
    });

    it("rejects spoofed MIME type when magic byte signature does not match", async () => {
      // Disguise text file as image/jpeg
      const fakeJpeg = new Blob(["This is a text script, not a jpeg image"], {
        type: "image/jpeg",
      });
      const formData = new FormData();
      formData.append("prescription", fakeJpeg, "fake.jpg");

      const req = new NextRequest("http://localhost/api/medsutra/extract", {
        method: "POST",
        body: formData,
        headers: {
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
      });

      const res = await extractHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid file signature");
    });

    it("distinguishes demo mode cleanly with transparent disclaimer", async () => {
      // Real JPEG signature: FF D8 FF E0
      const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const validJpeg = new Blob([validJpegBytes], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("prescription", validJpeg, "sample.jpg");

      const req = new NextRequest("http://localhost/api/medsutra/extract", {
        method: "POST",
        body: formData,
        headers: {
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
      });

      const res = await extractHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.source).toBe("demo");
      expect(data.message).toContain("Pre-packaged demonstration templates loaded");
      expect(data.extractions.length).toBeGreaterThanOrEqual(1);
    });

    it("requires explicit human approval and prevents duplicate medication creation", async () => {
      // Step 1: Human reviewer approves new medication
      const uniqueMedName = "Novel Beta-Blocker " + Date.now();
      const approveReq = new Request("http://localhost/api/medications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          name: uniqueMedName,
          dosage: "25 mg",
          instructions: "Take once daily in morning",
          slot: "morning",
          scheduleTime: "08:00 AM",
          reason: "Approved from MedSutra prescription review",
        }),
      });

      const approveRes = await createMedHandler(approveReq);
      expect(approveRes.status).toBe(201);
      const approveData = await approveRes.json();
      expect(approveData.success).toBe(true);
      expect(approveData.data.name).toBe(uniqueMedName);

      // Step 2: Attempt duplicate submission of same medication name -> must return 409 Conflict
      const duplicateReq = new Request("http://localhost/api/medications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "family_manager",
          "x-guardian-actor-name": "Sarah Thompson",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          name: uniqueMedName,
          dosage: "50 mg",
          instructions: "Increased dose attempt",
          slot: "morning",
          scheduleTime: "08:00 AM",
          reason: "Duplicate submission attempt",
        }),
      });

      const duplicateRes = await createMedHandler(duplicateReq);
      expect(duplicateRes.status).toBe(409);
      const duplicateData = await duplicateRes.json();
      expect(duplicateData.success).toBe(false);
      expect(duplicateData.error).toContain("already active");
    });
  });

  describe("Module B: Caregiver Wellbeing & Privacy Guardrails", () => {
    it("rejects unauthenticated wellbeing check-in", async () => {
      delete process.env.ENABLE_TEST_AUTH_HEADERS;
      const req = new NextRequest("http://localhost/api/wellbeing/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sleepHours: 7,
          mood: 3,
          stress: 3,
          energy: 3,
          shareWithFamily: false,
        }),
      });

      const res = await checkinHandler(req);
      expect(res.status).toBe(401);
      process.env.ENABLE_TEST_AUTH_HEADERS = "true";
    });

    it("derives caregiver identity strictly from server session and enforces privacy filtering", async () => {
      // 1. Caregiver Priya records private check-in
      const privateCheckinReq = new NextRequest("http://localhost/api/wellbeing/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "caregiver",
          "x-guardian-actor-name": "Priya Sharma, RN",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          caregiverId: "attacker-spoofed-id", // must be overridden by session
          sleepHours: 5,
          mood: 2,
          stress: 4,
          energy: 2,
          note: "Private confidential notes",
          shareWithFamily: false, // PRIVATE
        }),
      });

      const privateRes = await checkinHandler(privateCheckinReq);
      expect(privateRes.status).toBe(201);
      const savedCheckin = await privateRes.json();
      const checkinRecord = savedCheckin.checkIn || savedCheckin.data;
      expect(checkinRecord.caregiverId).toBe("Priya Sharma, RN");
      expect(checkinRecord.shareWithFamily).toBe(false);

      // 2. Family manager requests Priya's history -> private record must be hidden
      const familyReq = new NextRequest(
        "http://localhost/api/wellbeing/history?caregiverId=Priya%20Sharma,%20RN",
        {
          headers: {
            "x-guardian-role": "family_manager",
            "x-guardian-actor-name": "Sarah Thompson",
            "x-guardian-profile-id": "profile-eleanor-thompson",
          },
        }
      );

      const familyRes = await historyHandler(familyReq);
      expect(familyRes.status).toBe(200);
      const familyData = await familyRes.json();
      expect(familyData.privacyEnforced).toBe(true);
      // Private check-in must not be visible to family
      const leakedPrivate = familyData.history.find(
        (h: any) => h.caregiverId === "Priya Sharma, RN" && h.shareWithFamily === false
      );
      expect(leakedPrivate).toBeUndefined();

      // 3. Caregiver themselves can view their own private check-in
      const selfReq = new NextRequest(
        "http://localhost/api/wellbeing/history?caregiverId=Priya%20Sharma,%20RN",
        {
          headers: {
            "x-guardian-role": "caregiver",
            "x-guardian-actor-name": "Priya Sharma, RN",
            "x-guardian-profile-id": "profile-eleanor-thompson",
          },
        }
      );

      const selfRes = await historyHandler(selfReq);
      expect(selfRes.status).toBe(200);
      const selfData = await selfRes.json();
      expect(selfData.privacyEnforced).toBe(false);
      const ownPrivate = selfData.history.find(
        (h: any) => h.caregiverId === "Priya Sharma, RN" && h.shareWithFamily === false
      );
      expect(ownPrivate).toBeDefined();

      // 4. Peer caregiver is forbidden (403) from accessing another caregiver's records
      const peerReq = new NextRequest(
        "http://localhost/api/wellbeing/history?caregiverId=Priya%20Sharma,%20RN",
        {
          headers: {
            "x-guardian-role": "caregiver",
            "x-guardian-actor-name": "Nurse Joy",
            "x-guardian-profile-id": "profile-eleanor-thompson",
          },
        }
      );

      const peerRes = await historyHandler(peerReq);
      expect(peerRes.status).toBe(403);
      const peerData = await peerRes.json();
      expect(peerData.success).toBe(false);
      expect(peerData.error).toContain("Forbidden");
    });

    it("prevents duplicate backup relief coverage requests in CareLoop", async () => {
      // 1. Submit initial relief coverage request
      const req1 = new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guardian-role": "caregiver",
          "x-guardian-actor-name": "Priya Sharma, RN",
          "x-guardian-profile-id": "profile-eleanor-thompson",
        },
        body: JSON.stringify({
          action: "backup_request",
          reason: "High fatigue from back-to-back night shifts",
        }),
      });

      const res1 = await taskHandler(req1);
      // If one already existed in the store, it returns 409; otherwise 200 then next returns 409
      if (res1.status === 200) {
        const data1 = await res1.json();
        expect(data1.success).toBe(true);

        const req2 = new Request("http://localhost/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-guardian-role": "caregiver",
            "x-guardian-actor-name": "Priya Sharma, RN",
            "x-guardian-profile-id": "profile-eleanor-thompson",
          },
          body: JSON.stringify({
            action: "backup_request",
            reason: "Duplicate backup request attempt",
          }),
        });

        const res2 = await taskHandler(req2);
        expect(res2.status).toBe(409);
        const data2 = await res2.json();
        expect(data2.success).toBe(false);
        expect(data2.error).toContain("already pending review");
      } else {
        expect(res1.status).toBe(409);
        const data1 = await res1.json();
        expect(data1.error).toContain("already pending review");
      }
    });
  });
});
