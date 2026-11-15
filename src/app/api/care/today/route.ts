import { NextResponse } from "next/server";
import { guardianStore } from "@/lib/store";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    const role = session?.authenticated ? session.role : undefined;

    // Sanitize profile to prevent sensitive credentials (PINs) from being exposed in HTTP responses
    const profile = guardianStore.getSanitizedProfile(role);
    const members = guardianStore.getMembers();
    const medications = guardianStore.getMedications();
    const occurrences = guardianStore.getOccurrences();
    const appointments = guardianStore.getAppointments();
    const tasks = guardianStore.getTasks();
    const notifications = guardianStore.getNotifications();
    const auditEvents = guardianStore.getAuditEvents();
    const brief = guardianStore.getDailyCareBrief();
    const refillRunways = guardianStore.getRefillRunways();

    return NextResponse.json({
      success: true,
      data: {
        profile,
        members,
        medications,
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
