import { NextResponse } from "next/server";
import { careRepository } from "@/lib/db/repository";
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

    // Fetch through persistent database repository (PostgreSQL/Supabase)
    const profile = await careRepository.getSanitizedProfile(actor.role, actor.profileId);
    const members = await careRepository.getMembers(actor.profileId);
    const medications = await careRepository.getMedications(actor.profileId);
    const versions = await careRepository.getMedicationVersions();
    const occurrences = await careRepository.getOccurrences(actor.profileId);
    const appointments = await careRepository.getAppointments(actor.profileId);
    const tasks = await careRepository.getTasks(actor.profileId);
    const notifications = await careRepository.getNotifications();
    const auditEvents = await careRepository.getAuditEvents(actor.profileId);

    // Dynamic aggregations
    const brief = guardianStore.getDailyCareBrief();
    const refillRunways = guardianStore.getRefillRunways();

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
  } catch (error: any) {
    console.error("[api/care/today] Error:", error?.message);
    return NextResponse.json(
      { success: false, error: "Failed to fetch care data" },
      { status: 500 }
    );
  }
}
