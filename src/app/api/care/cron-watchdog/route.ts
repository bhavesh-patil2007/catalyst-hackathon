import { NextResponse } from "next/server";
import { guardianStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const forceCheck = url.searchParams.get("force") === "true";

    // Autonomous evaluation of overdue/missed routines
    const occurrences = guardianStore.getOccurrences();
    const scheduled = occurrences.filter(
      (o) => o.status === "SCHEDULED" || o.status === "PENDING"
    );

    let escalatedCount = 0;
    const escalatedTasks = [];

    for (const occ of scheduled) {
      // In production, check timestamp vs current time + grace period (30 mins)
      // If force=true or unconfirmed routine, escalate
      if (forceCheck || occ.status === "PENDING" || occ.scheduledTime.includes("01:00 PM")) {
        const task = guardianStore.escalateUnconfirmedDose(occ.id);
        if (task) {
          escalatedCount++;
          escalatedTasks.push(task);

          // Proactively send notification email to primary caregiver
          guardianStore.sendNotification({
            id: `watchdog-notif-${task.id}`,
            dedupeKey: `escalation-${occ.id}-${new Date().toISOString().slice(0, 10)}`,
            recipientEmail: "priya.caregiver@oasiscare.demo.local",
            recipientRole: "Primary Caregiver",
            type: "MISSED_DOSE_ESCALATION",
            subject: `CareLoop Urgent: Unconfirmed dose for ${occ.medicationName}`,
            bodyPreview: `Autonomous watchdog detected unconfirmed routine for ${occ.medicationName}. Task #${task.id} created.`,
            status: "DELIVERED",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checkedCount: scheduled.length,
      escalatedCount,
      tasks: escalatedTasks,
      message:
        escalatedCount > 0
          ? `Watchdog escalated ${escalatedCount} unconfirmed routines into CareLoop tasks.`
          : "All active medication routines are up to date.",
    });
  } catch (error) {
    console.error("[Watchdog]", error);
    return NextResponse.json(
      { success: false, error: "Failed to run care watchdog" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
