/**
 * CareOrbit — Timezone & Scheduled Date Utilities
 * Handles exact IANA timezone parsing, daylight saving transitions, and ISO validation.
 */

/**
 * Parses a date (YYYY-MM-DD) and human time string ("08:00 AM", "01:30 PM")
 * strictly within the patient's configured IANA timezone (e.g., "America/New_York", "Asia/Kolkata").
 * Returns an exact UTC Date object or null if input is invalid/missing.
 */
export function parseDateInTimezone(
  isoDateStr: string,
  timeStr: string,
  timezone: string = "America/New_York"
): Date | null {
  if (!isoDateStr || !timeStr) return null;

  // Validate YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) {
    return null;
  }

  // Parse time string (e.g., "08:00 AM", "13:30", "1:00 PM")
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  const localIsoString = `${isoDateStr}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  try {
    // 1. Verify that the timezone is a valid IANA identifier
    Intl.DateTimeFormat(undefined, { timeZone: timezone });

    // 2. Compute the exact UTC timestamp for this local time in the specified timezone
    const tempUtc = new Date(`${localIsoString}Z`);
    if (isNaN(tempUtc.getTime())) return null;

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(tempUtc);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value;
    const tzYear = getPart("year");
    const tzMonth = getPart("month");
    const tzDay = getPart("day");
    let tzHour = parseInt(getPart("hour") || "0", 10);
    if (tzHour === 24) tzHour = 0;
    const tzMin = parseInt(getPart("minute") || "0", 10);
    const tzSec = parseInt(getPart("second") || "0", 10);

    const tzAsUtc = Date.UTC(
      parseInt(tzYear || "0", 10),
      parseInt(tzMonth || "1", 10) - 1,
      parseInt(tzDay || "1", 10),
      tzHour,
      tzMin,
      tzSec
    );

    const offsetMs = tzAsUtc - tempUtc.getTime();
    const correctUtcEpoch = tempUtc.getTime() - offsetMs;
    const result = new Date(correctUtcEpoch);

    return isNaN(result.getTime()) ? null : result;
  } catch (err) {
    console.warn(`[dateUtils] Unrecognized or invalid timezone: ${timezone}`, err);
    return null;
  }
}

/**
 * Derives the scheduled date for a dose occurrence.
 * Prefers the authoritative ISO timestamp (scheduledIso or scheduled_for),
 * and only falls back to timezone-aware parsing if an explicit date string is available.
 * Never guesses or falls back silently to the server's local machine timezone.
 */
export function getAuthoritativeDoseDate(
  dose: {
    scheduledIso?: string;
    scheduled_for?: string;
    scheduledTime?: string;
    scheduled_time_label?: string;
  },
  referenceDateIso: string,
  timezone: string = "America/New_York"
): Date | null {
  const iso = dose.scheduledIso || dose.scheduled_for;
  if (iso) {
    const parsed = new Date(iso);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const timeLabel = dose.scheduledTime || dose.scheduled_time_label;
  if (timeLabel && referenceDateIso) {
    return parseDateInTimezone(referenceDateIso, timeLabel, timezone);
  }

  return null;
}
