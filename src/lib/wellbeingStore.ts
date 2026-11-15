function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface WellbeingCheckIn {
  id: string;
  caregiverId: string;
  date: string; // ISO date YYYY-MM-DD
  sleepHours: number; // 0-12
  mood: 1 | 2 | 3 | 4 | 5; // 1=very bad, 5=very good
  stress: 1 | 2 | 3 | 4 | 5; // 1=very high stress, 5=very low
  energy: 1 | 2 | 3 | 4 | 5; // 1=exhausted, 5=energized
  note?: string;
  shareWithFamily: boolean;
  timestamp: string;
}

export type CheckInRecord = WellbeingCheckIn;

export type BurnoutRisk = "low" | "moderate" | "high";

// In-memory store: map of caregiverId → array of check-ins (last 30 days)
const store = new Map<string, WellbeingCheckIn[]>();

function trimToLast30Days(entries: WellbeingCheckIn[]): WellbeingCheckIn[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= cutoffStr);
}

export function addCheckIn(
  data: Omit<WellbeingCheckIn, "id" | "timestamp" | "date">
): WellbeingCheckIn {
  const entry: WellbeingCheckIn = {
    ...data,
    id: generateId(),
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
  };

  const existing = store.get(data.caregiverId) ?? [];
  // Remove any existing check-in for today (one per day)
  const filtered = existing.filter((e) => e.date !== entry.date);
  const updated = trimToLast30Days([...filtered, entry]);
  store.set(data.caregiverId, updated);
  return entry;
}

export function getHistory(caregiverId: string): WellbeingCheckIn[] {
  const entries = store.get(caregiverId) ?? [];
  return trimToLast30Days(entries).sort((a, b) => a.date.localeCompare(b.date));
}

export function getBurnoutRisk(caregiverId: string): BurnoutRisk {
  const entries = store.get(caregiverId) ?? [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const recent = entries.filter((e) => e.date >= cutoff);
  if (recent.length === 0) return "low";

  const avgMood = recent.reduce((s, e) => s + e.mood, 0) / recent.length;
  const avgEnergy = recent.reduce((s, e) => s + e.energy, 0) / recent.length;
  const composite = (avgMood + avgEnergy) / 2;

  if (composite < 2.5) return "high";
  if (composite < 3.5) return "moderate";
  return "low";
}

export function clearCheckInsForTesting(): void {
  store.clear();
}
