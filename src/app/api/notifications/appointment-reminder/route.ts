import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { dispatchProactiveEmail } from "@/lib/notificationService";
import { getActorFromSessionOrHeader } from "@/lib/authGuard";

const reminderSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId is required"),
});

export async function POST(request: Request) {
  try {
    // 1. Enforce authentication: strictly authenticated members can trigger appointment notifications
    const authResult = await getActorFromSessionOrHeader(request, [
      "owner",
      "family_manager",
      "caregiver",
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const validated = reminderSchema.parse(body);

    const appointments = guardianStore.getAppointments();
    const appointment = appointments.find((a) => a.id === validated.appointmentId);

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 }
      );
    }

    const members = guardianStore.getMembers();
    const recipients = members.filter(
      (m) => m.role === "family_manager" || m.role === "caregiver"
    );

    const profile = guardianStore.getProfile();
    const subject = `Upcoming Doctor Visit: ${appointment.doctorName} — ${appointment.dateLabel}`;
    const bodyPreview = `Reminder: Upcoming consultation with ${appointment.doctorName} on ${appointment.dateLabel} at ${appointment.timeLabel} (${appointment.clinicName}).`;

    const htmlContent = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:12px;">
        <h2 style="color:#2d4a3e;margin-top:0;">Guardian Oasis &mdash; Appointment Reminder</h2>
        <p>Upcoming consultation reminder for <strong>${profile.displayName}</strong>:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Doctor</td>
            <td style="padding:8px;">${appointment.doctorName}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Specialty</td>
            <td style="padding:8px;">${appointment.specialty ?? "N/A"}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Clinic</td>
            <td style="padding:8px;">${appointment.clinicName}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Address</td>
            <td style="padding:8px;">${appointment.address}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Date &amp; Time</td>
            <td style="padding:8px;">${appointment.dateLabel} at ${appointment.timeLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Transport</td>
            <td style="padding:8px;">${appointment.transportAssigned ? "Arranged" : "Action Needed"}</td>
          </tr>
        </table>
        ${
          appointment.questionsToAsk && appointment.questionsToAsk.length > 0
            ? `<p><strong>Questions to Ask:</strong></p><ul>${appointment.questionsToAsk.map((q) => `<li>${q}</li>`).join("")}</ul>`
            : ""
        }
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="font-size:12px;color:#888;">This reminder was dispatched by Guardian Oasis CareLoop proactive notification service.</p>
      </div>
    `;

    const results = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const recipient of recipients) {
      const dedupeKey = `appt-reminder-${appointment.id}-${recipient.email}-${today}`;
      const dispatchResult = await dispatchProactiveEmail({
        dedupeKey,
        recipientEmail: recipient.email,
        recipientRole: recipient.role,
        type: "APPOINTMENT_REMINDER",
        subject,
        htmlContent,
        bodyPreview,
      });
      results.push({ email: recipient.email, ...dispatchResult });
    }

    return NextResponse.json({
      success: true,
      message: `Appointment reminder processed for ${recipients.length} care circle member(s).`,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to dispatch appointment reminder" },
      { status: 500 }
    );
  }
}
