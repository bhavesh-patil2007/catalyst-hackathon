import { NextResponse } from "next/server";
import { guardianStore } from "@/lib/store";
import { dispatchProactiveEmail } from "@/lib/notificationService";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const forceCheck = url.searchParams.get("force") === "true";
    const todayIso = new Date().toISOString().slice(0, 10);

    const profile = guardianStore.getProfile();
    const members = guardianStore.getMembers();
    const occurrences = guardianStore.getOccurrences();
    const appointments = guardianStore.getAppointments();

    const results = {
      timestamp: new Date().toISOString(),
      upcomingDoseRemindersSent: 0,
      missedDoseEscalations: 0,
      appointmentRemindersSent: 0,
      tasksCreated: [] as string[],
    };

    // 1. Proactive Upcoming Medication Reminders (DOSE_DUE)
    const upcomingDoses = occurrences.filter((o) => o.status === "SCHEDULED");
    for (const dose of upcomingDoses) {
      const elderMember = members.find((m) => m.role === "owner");
      if (elderMember) {
        const dedupeKey = `dose-due-${dose.id}-${todayIso}`;
        const subject = `Medication Reminder: ${dose.medicationName} (${dose.scheduledTime})`;
        const bodyPreview = `Good morning ${profile.displayName}. Your routine for ${dose.medicationName} (${dose.doseText}) is due at ${dose.scheduledTime}.`;

        const dispatchRes = await dispatchProactiveEmail({
          dedupeKey,
          recipientEmail: elderMember.email,
          recipientRole: "Older Adult",
          type: "DOSE_DUE",
          subject,
          htmlContent: `<h2>Guardian Oasis Routine Reminder</h2><p>${bodyPreview}</p><p>Instructions: ${dose.instructions}</p>`,
          bodyPreview,
        });

        if (dispatchRes.dispatched || dispatchRes.status === "CONFIG_REQUIRED") {
          results.upcomingDoseRemindersSent++;
        }
      }
    }

    // 2. Autonomous Escalation for Missed / Overdue Doses (CareLoop Closed-Loop)
    const unconfirmedDoses = occurrences.filter(
      (o) => o.status === "PENDING" || (forceCheck && o.scheduledTime.includes("01:00 PM"))
    );

    for (const dose of unconfirmedDoses) {
      const task = guardianStore.escalateUnconfirmedDose(dose.id);
      if (task) {
        results.missedDoseEscalations++;
        results.tasksCreated.push(task.id);

        const primaryCaregiver = members.find((m) => m.role === "caregiver");
        if (primaryCaregiver) {
          const dedupeKey = `escalation-notif-${dose.id}-${todayIso}`;
          const subject = `CareLoop Escalation: Unconfirmed Routine for ${profile.displayName}`;
          const bodyPreview = `Routine for ${dose.medicationName} remained unconfirmed past the grace period. Follow-up task #${task.id} has been created.`;

          await dispatchProactiveEmail({
            dedupeKey,
            recipientEmail: primaryCaregiver.email,
            recipientRole: "Primary Caregiver",
            type: "MISSED_DOSE_ESCALATION",
            subject,
            htmlContent: `<h2>CareLoop Escalation Notice</h2><p><strong>${dose.medicationName}</strong> remained unconfirmed.</p><p>Please review task #${task.id} in the CareLoop Inbox.</p>`,
            bodyPreview,
          });
        }
      }
    }

    // 3. Proactive Doctor Appointment Reminders
    for (const appt of appointments) {
      const familyManager = members.find((m) => m.role === "family_manager");
      if (familyManager) {
        const dedupeKey = `appt-cron-reminder-${appt.id}-${todayIso}`;
        const subject = `Upcoming Doctor Consultation: ${appt.doctorName} (${appt.dateLabel})`;
        const bodyPreview = `Reminder: ${profile.displayName} has an appointment with ${appt.doctorName} on ${appt.dateLabel} at ${appt.timeLabel} (${appt.clinicName}).`;

        const dispatchRes = await dispatchProactiveEmail({
          dedupeKey,
          recipientEmail: familyManager.email,
          recipientRole: "Family Manager",
          type: "APPOINTMENT_REMINDER",
          subject,
          htmlContent: `<h2>Guardian Oasis Appointment Reminder</h2><p>${bodyPreview}</p><p>Transport: ${appt.transportAssigned ? "Arranged" : "Action Needed"}</p>`,
          bodyPreview,
        });

        if (dispatchRes.dispatched || dispatchRes.status === "CONFIG_REQUIRED") {
          results.appointmentRemindersSent++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Autonomous care watchdog completed routine scan.",
      results,
    });
  } catch (error) {
    console.error("[Watchdog]", error);
    return NextResponse.json(
      { success: false, error: "Watchdog execution failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
