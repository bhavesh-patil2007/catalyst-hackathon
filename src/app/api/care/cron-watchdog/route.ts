import { NextResponse } from "next/server";
import { careRepository } from "@/lib/db/repository";
import { dispatchProactiveEmail } from "@/lib/notificationService";
import { DoseOccurrence } from "@/types";
import { getAuthoritativeDoseDate } from "@/lib/dateUtils";

const GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes grace period
const UPCOMING_WINDOW_MS = 30 * 60 * 1000; // 30 minutes before dose

export async function POST(request: Request) {
  try {
    // 1. Secure Server-to-Server Authentication (Bearer Token or x-cron-secret)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const cronHeader = request.headers.get("x-cron-secret");

    const isAuthorized =
      (cronSecret &&
        (authHeader === `Bearer ${cronSecret}` || cronHeader === cronSecret)) ||
      (process.env.NODE_ENV === "test" && (!cronSecret || cronHeader === "test-cron-secret"));

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid or missing cron authentication credential.",
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    // Public force-trigger is strictly disabled in production
    const isProd = process.env.NODE_ENV === "production";
    const forceCheck = !isProd && url.searchParams.get("force") === "true";

    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);

    // Fetch through database repository
    const profile = await careRepository.getProfile();
    const members = await careRepository.getMembers(profile.id);
    const occurrences = await careRepository.getOccurrences(profile.id);
    const appointments = await careRepository.getAppointments(profile.id);
    const existingTasks = await careRepository.getTasks(profile.id);

    const results = {
      timestamp: now.toISOString(),
      upcomingDoseRemindersSent: 0,
      missedDoseEscalations: 0,
      appointmentRemindersSent: 0,
      tasksCreated: [] as string[],
    };

    // 2. Proactive Upcoming Medication Reminders (Window: Next 30 minutes)
    for (const dose of occurrences) {
      if (dose.status !== "SCHEDULED") continue;

      const scheduledDate = getAuthoritativeDoseDate(dose, todayIso, profile.timezone);
      if (!scheduledDate) {
        console.warn(`[Watchdog] Skipping dose ${dose.id}: invalid or unparseable scheduled date.`);
        continue;
      }
      const diffMs = scheduledDate.getTime() - now.getTime();

      // Check if scheduled time falls within the upcoming reminder window (0 to 30 min from now)
      const isDueSoon = forceCheck || (diffMs >= 0 && diffMs <= UPCOMING_WINDOW_MS);

      if (isDueSoon) {
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
    }

    // 3. Autonomous Escalation for Missed / Overdue Doses past Grace Period
    for (const dose of occurrences) {
      // Taken, resolved, or explicitly skipped doses are never escalated
      if (
        dose.status === "MARKED_TAKEN" ||
        dose.status === "RESOLVED" ||
        dose.status === "SKIPPED"
      ) {
        continue;
      }

      // Respect elder privacy preferences: do not escalate if marked doNotNotifyFamily or silent
      if (dose.silentRoutine || dose.checkIn?.doNotNotifyFamily) {
        continue;
      }

      const scheduledDate = getAuthoritativeDoseDate(dose, todayIso, profile.timezone);
      if (!scheduledDate) {
        console.warn(`[Watchdog] Skipping dose ${dose.id}: invalid scheduled date for escalation.`);
        continue;
      }
      const overdueMs = now.getTime() - scheduledDate.getTime();

      // Eligible only if current time is past scheduled time + configured grace period
      const isOverdue = forceCheck || (dose.status === "PENDING" && overdueMs > GRACE_PERIOD_MS);

      if (isOverdue) {
        // Enforce idempotency: verify no active task already exists for this occurrence
        const existingOpenTask = existingTasks.find(
          (t) => t.sourceOccurrenceId === dose.id && (t.status === "OPEN" || t.status === "CLAIMED")
        );

        if (!existingOpenTask) {
          const task = await careRepository.escalateUnconfirmedDose(dose.id);
          if (task) {
            results.missedDoseEscalations++;
            results.tasksCreated.push(task.id);

            const primaryCaregiver = members.find((m) => m.role === "caregiver");
            if (primaryCaregiver) {
              const dedupeKey = `escalation-notif-${dose.id}-${todayIso}`;
              const subject = `CareLoop Escalation: Unconfirmed Routine for ${profile.displayName}`;
              const bodyPreview = `Routine for ${dose.medicationName} remained unconfirmed past the 30-minute grace period. Follow-up task #${task.id} has been created.`;

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
      }
    }

    // 4. Proactive Doctor Appointment Reminders (Window: Next 24-48 hours)
    for (const appt of appointments) {
      if (appt.status !== "UPCOMING") continue;

      const apptDate = new Date(appt.dateTime);
      const msUntilAppt = !isNaN(apptDate.getTime()) ? apptDate.getTime() - now.getTime() : 0;
      // Remind only if appointment falls within the configured 48-hour window
      const isWithinReminderWindow =
        forceCheck || (msUntilAppt > 0 && msUntilAppt <= 48 * 60 * 60 * 1000);

      if (isWithinReminderWindow) {
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
    }

    return NextResponse.json({
      success: true,
      message: "Autonomous care watchdog completed routine scan.",
      results,
    });
  } catch (error: any) {
    console.error("[Watchdog Error]", error?.message);
    return NextResponse.json(
      { success: false, error: "Watchdog execution failed" },
      { status: 500 }
    );
  }
}

/**
 * Reject GET requests with 405 Method Not Allowed.
 * Watchdog execution must only occur via authorized POST requests.
 */
export async function GET() {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "POST",
    },
  });
}
