import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { dispatchProactiveEmail } from "@/lib/notificationService";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const emailTestSchema = z.object({
  recipientEmail: z.string().email(),
  recipientRole: z.string(),
  type: z.enum(["DOSE_DUE", "MISSED_DOSE_ESCALATION", "APPOINTMENT_REMINDER"]),
  customSubject: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // 1. Enforce authentication: strictly authenticated owners and family managers can trigger test emails
    const authResult = await getActorFromSessionOrHeader(request, [
      "owner",
      "family_manager",
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const validated = emailTestSchema.parse(body);

    const profile = guardianStore.getProfile();
    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let subject = "Guardian Oasis Notification";
    let bodyPreview = "A care routine requires attention.";

    if (validated.type === "DOSE_DUE") {
      subject = `Guardian Oasis: Scheduled Medication Routine Reminder (${timeString})`;
      bodyPreview = `Good day. A scheduled medication routine for ${profile.displayName} is due at ${timeString}. Please sign in to view and record check-in.`;
    } else if (validated.type === "MISSED_DOSE_ESCALATION") {
      subject = `CareLoop Escalation: Unconfirmed Routine for ${profile.displayName}`;
      bodyPreview = `A routine remained unconfirmed after the grace window. CareLoop created follow-up task #C-${Math.floor(100 + Math.random() * 900)}. Assigned to care circle.`;
    } else if (validated.type === "APPOINTMENT_REMINDER") {
      subject = `Guardian Oasis: Doctor Visit Reminder for ${profile.displayName}`;
      bodyPreview = `Reminder: Upcoming consultation with Dr. Robert Vance, MD tomorrow at 10:30 AM at St. Jude Clinic. Transport is marked as arranged.`;
    }

    if (validated.customSubject) {
      subject = validated.customSubject;
    }

    const dedupeKey = `email-dispatch-${validated.type}-${validated.recipientEmail}-${new Date().toISOString().slice(0, 10)}`;

    const htmlContent = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:12px;">
        <h2 style="color:#2d4a3e;margin-top:0;">Guardian Oasis Care Reminder</h2>
        <p style="font-size:16px;color:#333;"><strong>${subject}</strong></p>
        <p style="color:#555;line-height:1.6;">${bodyPreview}</p>
        <div style="margin:20px 0;padding:12px;background:#f0faf5;border-radius:8px;font-size:13px;color:#244436;">
          Recipient: <strong>${validated.recipientEmail}</strong> (${validated.recipientRole})<br/>
          Patient Profile: <strong>${profile.displayName}</strong>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="font-size:12px;color:#888;">This is an enterprise care notification dispatched by Guardian Oasis CareLoop Proactive Dispatcher.</p>
      </div>
    `;

    const result = await dispatchProactiveEmail({
      dedupeKey,
      recipientEmail: validated.recipientEmail,
      recipientRole: validated.recipientRole,
      type: validated.type,
      subject,
      htmlContent,
      bodyPreview,
    });

    return NextResponse.json({
      success: true,
      message: result.dispatched
        ? `Proactive email delivered to ${validated.recipientEmail}`
        : result.deduplicated
        ? "Notification was suppressed (already dispatched today)"
        : "Email logged in CareLoop ledger (RESEND_API_KEY unconfigured).",
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to dispatch test notification" },
      { status: 500 }
    );
  }
}
