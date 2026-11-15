import { NextResponse } from "next/server";
import { guardianStore } from "@/lib/store";
import { dispatchProactiveEmail } from "@/lib/notificationService";

const GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes grace period
const UPCOMING_WINDOW_MS = 30 * 60 * 1000; // 30 minutes before dose

/**
 * Parses a time string like "08:00 AM", "01:00 PM", "8:00 PM" into today's local Date.
 */
function parseScheduledTimeToDate(timeStr: string, referenceDate: Date = new Date()): Date {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) {
    return new Date(referenceDate);
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const target = new Date(referenceDate);
  target.setHours(hours, minutes, 0, 0);
  return target;
}

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

    const profile = guardianStore.getProfile();
    const members = guardianStore.getMembers();
    const occurrences = guardianStore.getOccurrences();
    const appointments = guardianStore.getAppointments();
    const existingTasks = guardianStore.getTasks();

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

      const scheduledDate = parseScheduledTimeToDate(dose.scheduledTime, now);
      const diffMs = scheduledDate.getTime() - now.getTime();
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
      if (dose.status === "MARKED_TAKEN" || dose.status === "RESOLVED" || dose.status === "SKIPPED") {
        continue;
      }

      const scheduledDate = parseScheduledTimeToDate(dose.scheduledTime, now);
      const overdueMs = now.getTime() - scheduledDate.getTime();
      const isOverdue = forceCheck || (dose.status === "PENDING" && overdueMs > GRACE_PERIOD_MS);

      if (isOverdue) {
        // Enforce idempotency: Do not duplicate task if already open for this occurrence
        const existingOpenTask = existingTasks.find(
          (t) => t.sourceOccurrenceId === dose.id && (t.status === "OPEN" || t.status === "CLAIMED")
        );

        if (!existingOpenTask) {
          const task = guardianStore.escalateUnconfirmedDose(dose.id);
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
      // Remind if appointment is within 48 hours or forceCheck is active
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
  } catch (error) {
    console.error("[Watchdog]", error);
    return NextResponse.json(
      { success: false, error: "Watchdog execution failed" },
      { status: 500 }
    );
  }
}

/**
 * Reject GET requests with 405 Method Not Allowed.
 * Watchdog must only be invoked via POST with appropriate authorization.
 */
export async function GET() {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "POST",
    },
  });
}
