import { NextResponse } from "next/server";
import { guardianStore } from "@/lib/store";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

export async function GET(request: Request) {
  try {
    // Enforce authentication: only authenticated circle members can access patient data
    const authResult = await getActorFromSessionOrHeader(request, [
      "owner",
      "family_manager",
      "caregiver",
      "read_only",
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const { actor } = authResult;

    // Sanitize profile: strictly redact passcodes and circle invite codes from HTTP response
    const profile = guardianStore.getSanitizedProfile(actor.role);
    const members = guardianStore.getMembers();
    const medications = guardianStore.getMedications();
    const occurrences = guardianStore.getOccurrences();
    const appointments = guardianStore.getAppointments();
    const tasks = guardianStore.getTasks();
    const notifications = guardianStore.getNotifications();
    const auditEvents = guardianStore.getAuditEvents();
    const brief = guardianStore.getDailyCareBrief();
    const refillRunways = guardianStore.getRefillRunways();
    const versions = guardianStore.getMedicationVersions();

    return NextResponse.json({
      success: true,
      data: {
        profile,
        members,
        medications,
        versions,
        occurrences,
        appointments,
        tasks,
        notifications,
        auditEvents,
        brief,
        refillRunways,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch care data" },
      { status: 500 }
    );
  }
}
