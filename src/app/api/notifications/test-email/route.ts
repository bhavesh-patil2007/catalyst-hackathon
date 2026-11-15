import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { Resend } from "resend";

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

    // Real email via Resend (if API key is configured)
    let emailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "careorbit@yourdomain.com",
          to: [validated.recipientEmail],
          subject,
          html: `<h2 style="color:#2d4a3e;">Guardian Oasis Care Reminder</h2><p>${subject}</p><p>${bodyPreview}</p><hr/><p style="font-size:12px;color:#888;">Sent by Guardian Oasis &mdash; ${new Date().toISOString()}</p>`,
        });
        emailSent = true;
      } catch (emailError) {
        // Log but don't fail — store notification is already recorded
        console.error("[Resend] Email dispatch failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: sent
        ? emailSent
          ? "Proactive email sent successfully via Resend"
          : "Notification logged (Resend not configured or failed)"
        : "Duplicate email suppressed",
      notification: {
        recipientEmail: validated.recipientEmail,
        subject,
        bodyPreview,
        dedupeKey,
        sentAt: timeString,
        realEmailSent: emailSent,
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
