import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";

const emailTestSchema = z.object({
  recipientEmail: z.string().email(),
  recipientRole: z.string(),
  type: z.enum(["DOSE_DUE", "MISSED_DOSE_ESCALATION", "APPOINTMENT_REMINDER"]),
  customSubject: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = emailTestSchema.parse(body);

    const profile = guardianStore.getProfile();
    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let subject = "Guardian Oasis Notification";
    let bodyPreview = "A care routine requires attention.";

    if (validated.type === "DOSE_DUE") {
      subject = "Guardian Oasis: Scheduled Medication Routine Reminder";
      bodyPreview = `Good day. A scheduled medication routine for ${profile.displayName} is due at ${timeString}. Please sign in to view and record check-in.`;
    } else if (validated.type === "MISSED_DOSE_ESCALATION") {
      subject = `CareLoop Escalation: Action Required for ${profile.displayName}`;
      bodyPreview = `A routine remained unconfirmed after the grace window. CareLoop created follow-up task #C-${Math.floor(100 + Math.random() * 900)}. Assigned to care circle.`;
    } else if (validated.type === "APPOINTMENT_REMINDER") {
      subject = `Guardian Oasis: Doctor Visit Reminder for ${profile.displayName}`;
      bodyPreview = `Reminder: Upcoming consultation with Dr. Robert Vance, MD tomorrow at 10:30 AM at St. Jude Clinic. Transport is marked as arranged.`;
    }

    if (validated.customSubject) {
      subject = validated.customSubject;
    }

    const dedupeKey = `test-${validated.type}-${validated.recipientEmail}-${Date.now()}`;

    const sent = guardianStore.sendNotification({
      id: "notif-" + Date.now(),
      dedupeKey,
      recipientEmail: validated.recipientEmail,
      recipientRole: validated.recipientRole,
      type: validated.type,
      subject,
      bodyPreview,
      status: "DELIVERED",
      timestamp: timeString,
    });

    return NextResponse.json({
      success: true,
      message: sent ? "Proactive email sent successfully" : "Duplicate email suppressed",
      notification: {
        recipientEmail: validated.recipientEmail,
        subject,
        bodyPreview,
        dedupeKey,
        sentAt: timeString,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to dispatch notification" },
      { status: 500 }
    );
  }
}
