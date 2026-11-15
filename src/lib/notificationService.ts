import { careRepository } from "@/lib/db/repository";
import { NotificationJob } from "@/types";
import { Resend } from "resend";

export interface DispatchEmailOptions {
  dedupeKey: string;
  recipientEmail: string;
  recipientRole: string;
  type: "DOSE_DUE" | "MISSED_DOSE_ESCALATION" | "APPOINTMENT_REMINDER" | "TASK_CLAIMED";
  subject: string;
  htmlContent: string;
  bodyPreview: string;
}

export interface DispatchEmailResult {
  dispatched: boolean;
  deduplicated: boolean;
  status: "DELIVERED" | "ACCEPTED" | "CONFIG_REQUIRED" | "FAILED" | "SUPPRESSED";
  providerError?: string;
  providerMessageId?: string;
  jobId: string;
}

/**
 * Masks email address for privacy and PHI compliance in logs and audit trails.
 * Example: 'sarah.thompson@family.org' -> 's***@family.org'
 */
export function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "***@***";
  const [local, domain] = parts;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/**
 * Enterprise-grade Proactive Email Dispatcher for CareOrbit.
 * - Inspects actual Resend provider responses ({ data, error }).
 * - Distinguishes provider acceptance (queued) from delivery failure.
 * - Durable deduplication preventing alert fatigue.
 * - Exponential backoff on transient network faults.
 * - Masked PHI logging.
 */
export async function dispatchProactiveEmail(
  options: DispatchEmailOptions
): Promise<DispatchEmailResult> {
  const jobId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 1. Durable Deduplication Check
  const existingNotifications = await careRepository.getNotifications();
  const isDuplicate = existingNotifications.some((n) => n.dedupeKey === options.dedupeKey);
  if (isDuplicate) {
    return {
      dispatched: false,
      deduplicated: true,
      status: "SUPPRESSED",
      jobId,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const senderAddress = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;

  // 2. Provider availability check
  if (!apiKey) {
    const job: NotificationJob = {
      id: jobId,
      dedupeKey: options.dedupeKey,
      recipientEmail: options.recipientEmail,
      recipientRole: options.recipientRole,
      type: options.type,
      subject: options.subject,
      bodyPreview: options.bodyPreview,
      status: "CONFIG_REQUIRED",
      timestamp: timeString,
      providerError: "RESEND_API_KEY not configured. Set RESEND_API_KEY to enable live email dispatch.",
    };
    await careRepository.sendNotification(job);

    console.info(
      `[Notification:CONFIG_REQUIRED] To: ${maskEmail(options.recipientEmail)} | Subject: "${options.subject}"`
    );

    return {
      dispatched: false,
      deduplicated: false,
      status: "CONFIG_REQUIRED",
      providerError: "RESEND_API_KEY is missing.",
      jobId,
    };
  }

  // 3. Sender address validation for production
  const effectiveSender = senderAddress || "notifications@careorbit.internal";
  if (process.env.NODE_ENV === "production" && (!senderAddress || senderAddress.includes("yourdomain.com"))) {
    const job: NotificationJob = {
      id: jobId,
      dedupeKey: options.dedupeKey,
      recipientEmail: options.recipientEmail,
      recipientRole: options.recipientRole,
      type: options.type,
      subject: options.subject,
      bodyPreview: options.bodyPreview,
      status: "CONFIG_REQUIRED",
      timestamp: timeString,
      providerError: "Production EMAIL_FROM must be configured with a verified domain.",
    };
    await careRepository.sendNotification(job);

    return {
      dispatched: false,
      deduplicated: false,
      status: "CONFIG_REQUIRED",
      providerError: "Verified EMAIL_FROM domain is required in production.",
      jobId,
    };
  }

  // 4. Live dispatch with Resend and response verification
  const resend = new Resend(apiKey);
  let attempts = 0;
  const maxAttempts = 3;
  let lastErrorMsg: string | undefined;
  let providerId: string | undefined;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await resend.emails.send({
        from: effectiveSender,
        to: [options.recipientEmail],
        subject: options.subject,
        html: options.htmlContent,
      });

      // Resend returns { data, error }
      if (response.error) {
        lastErrorMsg = response.error.message || "Provider returned error during send";
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 200));
          continue;
        }
      } else if (response.data?.id) {
        providerId = response.data.id;
        break;
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || "Network exception during dispatch";
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 200));
      }
    }
  }

  if (providerId) {
    // Successfully accepted by provider
    const job: NotificationJob = {
      id: jobId,
      dedupeKey: options.dedupeKey,
      recipientEmail: options.recipientEmail,
      recipientRole: options.recipientRole,
      type: options.type,
      subject: options.subject,
      bodyPreview: options.bodyPreview,
      status: "ACCEPTED",
      timestamp: timeString,
      retryCount: attempts - 1,
    };
    await careRepository.sendNotification(job);

    console.info(
      `[Notification:ACCEPTED] To: ${maskEmail(options.recipientEmail)} | ProviderId: ${providerId} | Attempts: ${attempts}`
    );

    return {
      dispatched: true,
      deduplicated: false,
      status: "ACCEPTED",
      providerMessageId: providerId,
      jobId,
    };
  }

  // Dispatch failed across all attempts
  const failedJob: NotificationJob = {
    id: jobId,
    dedupeKey: options.dedupeKey,
    recipientEmail: options.recipientEmail,
    recipientRole: options.recipientRole,
    type: options.type,
    subject: options.subject,
    bodyPreview: options.bodyPreview,
    status: "FAILED",
    timestamp: timeString,
    retryCount: attempts,
    providerError: lastErrorMsg,
  };
  await careRepository.sendNotification(failedJob);

  console.warn(
    `[Notification:FAILED] To: ${maskEmail(options.recipientEmail)} | Error: ${lastErrorMsg}`
  );

  return {
    dispatched: false,
    deduplicated: false,
    status: "FAILED",
    providerError: lastErrorMsg,
    jobId,
  };
}
