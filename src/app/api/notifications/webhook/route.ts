import { NextRequest, NextResponse } from "next/server";
import { careRepository } from "@/lib/db/repository";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * Resend Webhook Handler.
 * Transitions notification states from ACCEPTED to DELIVERED (or FAILED) upon verified webhook event.
 * Enforces webhook signature / secret verification.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get("svix-signature") || req.headers.get("resend-signature");
      const timestamp = req.headers.get("svix-timestamp") || req.headers.get("resend-timestamp");

      if (!signature || !timestamp) {
        return NextResponse.json(
          { success: false, error: "Missing required webhook signature headers." },
          { status: 401 }
        );
      }

      // Verify HMAC SHA256 signature
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

      const signatureParts = signature.split(",");
      const matched = signatureParts.some((part) => {
        const val = part.startsWith("v1=") ? part.slice(3) : part;
        return crypto.timingSafeEqual(
          Buffer.from(val),
          Buffer.from(expectedSignature)
        );
      });

      if (!matched) {
        return NextResponse.json(
          { success: false, error: "Invalid webhook signature." },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload?.type; // e.g. 'email.delivered', 'email.bounced', 'email.complained'
    const emailId = payload?.data?.email_id || payload?.data?.id;

    if (!emailId) {
      return NextResponse.json({ success: true, message: "Ignored: No email_id present." });
    }

    const nowIso = new Date().toISOString();

    if (eventType === "email.delivered") {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseServerClient();
        if (supabase) {
          await supabase
            .from("notification_jobs")
            .update({
              status: "DELIVERED",
              delivered_at: nowIso,
            })
            .eq("provider_message_id", emailId);
        }
      }

      await careRepository.logAuditEvent({
        careProfileId: (await careRepository.getProfile()).id,
        actorName: "Resend Webhook Delivery Service",
        actorRole: "system",
        action: "NOTIFICATION_DELIVERED",
        entityType: "TASK",
        entityId: emailId,
        description: `Verified email delivery confirmation received from provider (emailId: ${emailId}).`,
      });

      return NextResponse.json({ success: true, status: "DELIVERED", emailId });
    }

    if (eventType === "email.bounced" || eventType === "email.complained") {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseServerClient();
        if (supabase) {
          await supabase
            .from("notification_jobs")
            .update({
              status: "FAILED",
              provider_error: `Provider event: ${eventType}`,
            })
            .eq("provider_message_id", emailId);
        }
      }

      return NextResponse.json({ success: true, status: "FAILED", emailId });
    }

    return NextResponse.json({ success: true, event: eventType });
  } catch (err: any) {
    console.error("[notifications/webhook] Error:", err?.message);
    return NextResponse.json(
      { success: false, error: "Failed to process webhook." },
      { status: 500 }
    );
  }
}
