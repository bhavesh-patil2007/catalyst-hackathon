import { NextResponse } from "next/server";
import { z } from "zod";
import { guardianStore } from "@/lib/store";
import { Resend } from "resend";

const reminderSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId is required"),
});

export async function POST(request: Request) {
  try {
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
    // Send to family managers and caregivers
    const recipients = members.filter(
      (m) => m.role === "family_manager" || m.role === "caregiver"
    );

    const profile = guardianStore.getProfile();

    const subject = `Appointment Reminder: ${appointment.doctorName} — ${appointment.dateLabel}`;
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2d4a3e;">Guardian Oasis &mdash; Appointment Reminder</h2>
        <p>This is a reminder for the following upcoming appointment for <strong>${profile.displayName}</strong>:</p>
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
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Date &amp; Time</td>
            <td style="padding:8px;">${appointment.dateLabel ?? appointment.dateTime} at ${appointment.timeLabel ?? ""}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f0faf5;">Transport</td>
            <td style="padding:8px;">${appointment.transportAssigned ? appointment.transportDetails ?? "Arranged" : "Not yet arranged"}</td>
          </tr>
        </table>
        ${
          appointment.questionsToAsk?.length
            ? `<p><strong>Questions to ask:</strong></p><ul>${appointment.questionsToAsk.map((q) => `<li>${q}</li>`).join("")}</ul>`
            : ""
        }
        <hr/>
        <p style="font-size:12px;color:#888;">Guardian Oasis &mdash; Care coordination made simple. Sent at ${new Date().toISOString()}</p>
      </div>
    `;

    const emailResults: { email: string; sent: boolean }[] = [];
    let realEmailSent = false;

    if (process.env.RESEND_API_KEY && recipients.length > 0) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      for (const member of recipients) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? "careorbit@yourdomain.com",
            to: [member.email],
            subject,
            html: htmlBody,
          });
          emailResults.push({ email: member.email, sent: true });
          realEmailSent = true;
        } catch (err) {
          console.error(`[Resend] Failed to email ${member.email}:`, err);
          emailResults.push({ email: member.email, sent: false });
        }
      }
    }

    // Record in notification store
    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    for (const member of recipients) {
      guardianStore.sendNotification({
        id: `notif-appt-${appointment.id}-${member.id}-${Date.now()}`,
        dedupeKey: `appt-reminder-${appointment.id}-${member.email}`,
        recipientEmail: member.email,
        recipientRole: member.role,
        type: "APPOINTMENT_REMINDER",
        subject,
        bodyPreview: `Reminder for ${appointment.doctorName} on ${appointment.dateLabel}.`,
        status: "DELIVERED",
        timestamp: timeString,
      });
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        doctorName: appointment.doctorName,
        dateLabel: appointment.dateLabel,
      },
      recipientCount: recipients.length,
      realEmailSent,
      emailResults,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to send appointment reminder" },
      { status: 500 }
    );
  }
}
