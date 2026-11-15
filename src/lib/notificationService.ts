import { guardianStore } from "@/lib/store";
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
  status: "DELIVERED" | "CONFIG_REQUIRED" | "FAILED" | "SUPPRESSED";
  providerError?: string;
  jobId: string;
}

/**
 * Enterprise-grade Proactive Email Dispatcher.
 * - Enforces deduplication using unique dedupeKeys.
 * - Employs safe retries with exponential backoff on transient network faults.
 * - Strictly does NOT simulate successful email delivery when RESEND_API_KEY is unconfigured.
 */
export async function dispatchProactiveEmail(
  options: DispatchEmailOptions
): Promise<DispatchEmailResult> {
  const jobId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 1. Deduplication Check
  const existingNotifications = guardianStore.getNotifications();
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

  // 2. Truthful provider availability check: If no API key, record as CONFIG_REQUIRED (NEVER simulate DELIVERED)
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
      providerError: "RESEND_API_KEY not configured. Set RESEND_API_KEY to enable live email delivery.",
    };
    guardianStore.sendNotification(job);

    return {
      dispatched: false,
      deduplicated: false,
      status: "CONFIG_REQUIRED",
      providerError: "RESEND_API_KEY is missing.",
      jobId,
    };
  }

  // 3. Live email sending with safe retries
  const resend = new Resend(apiKey);
  let lastError: any = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "careorbit@yourdomain.com",
        to: [options.recipientEmail],
        subject: options.subject,
        html: options.htmlContent,
      });

      const job: NotificationJob = {
        id: jobId,
        dedupeKey: options.dedupeKey,
        recipientEmail: options.recipientEmail,
        recipientRole: options.recipientRole,
        type: options.type,
        subject: options.subject,
        bodyPreview: options.bodyPreview,
        status: "DELIVERED",
        timestamp: timeString,
        retryCount: attempts - 1,
      };
      guardianStore.sendNotification(job);

      return {
        dispatched: true,
        deduplicated: false,
        status: "DELIVERED",
        jobId,
      };
    } catch (err: any) {
      lastError = err;
      if (attempts < maxAttempts) {
        // Exponential backoff: 200ms, 400ms
        await new Promise((resolve) => setTimeout(resolve, attempts * 200));
      }
    }
  }

  // 4. Failed after retries
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
    providerError: lastError?.message || "Transient Resend dispatch failure",
  };
  guardianStore.sendNotification(failedJob);

  return {
    dispatched: false,
    deduplicated: false,
    status: "FAILED",
    providerError: lastError?.message || "Failed after 3 retries",
    jobId,
  };
}
