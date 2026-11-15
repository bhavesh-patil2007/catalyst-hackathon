export type UserRole = "owner" | "family_manager" | "caregiver" | "read_only";

export type DoseStatus =
  | "SCHEDULED"
  | "PENDING"
  | "SNOOZED"
  | "MARKED_TAKEN"
  | "SKIPPED"
  | "NEEDS_HELP"
  | "NOT_SURE"
  | "UNCONFIRMED"
  | "RESOLVED";

export interface CareProfile {
  id: string;
  displayName: string;
  age: number;
  initials: string;
  avatarUrl?: string;
  conditions: string[];
  notes: string[];
  passcode: string; // 4-digit elder PIN
  circleInviteCode: string; // Family/Caregiver invite code
  timezone: string;
  locale: "en" | "hi";
}

export interface CareMember {
  id: string;
  careProfileId: string;
  name: string;
  email: string;
  role: UserRole;
  relationship: string;
  phone?: string;
  isPrimaryCaregiver?: boolean;
}

export interface Medication {
  id: string;
  careProfileId: string;
  name: string;
  dosage: string;
  instructions: string;
  pillColor: string;
  pillShape: "round" | "capsule" | "oval" | "liquid";
  active: boolean;
  currentVersion: number;
  remainingQuantity: number;
  dailyFrequency: number;
  refillThreshold: number;
  scheduleTime: string;
  slot: "morning" | "afternoon" | "evening" | "bedtime";
  silentRoutine?: boolean; // "Do not notify family for this routine"
}

export interface MedicationVersion {
  id: string;
  medicationId: string;
  version: number;
  labelName: string;
  doseText: string;
  instructions: string;
  effectiveFrom: string;
  createdBy: string;
  reason: string;
  confirmedBy?: string;
}

export interface DoseOccurrence {
  id: string;
  medicationId: string;
  medicationName: string;
  doseText: string;
  instructions: string;
  pillColor: string;
  pillShape: string;
  scheduledTime: string;
  scheduledIso: string;
  status: DoseStatus;
  updatedAt: string;
  silentRoutine?: boolean;
  checkIn?: DoseCheckIn;
}

export interface DoseCheckIn {
  id: string;
  occurrenceId: string;
  status: DoseStatus;
  actorName: string;
  actorRole: UserRole;
  recordedAt: string;
  note?: string;
  doNotNotifyFamily?: boolean;
}

export interface DoctorAppointment {
  id: string;
  careProfileId: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  address: string;
  dateTime: string;
  dateLabel: string;
  timeLabel: string;
  transportAssigned: boolean;
  transportDetails?: string;
  questionsToAsk: string[];
  postVisitNotes?: string;
  status: "UPCOMING" | "COMPLETED" | "CANCELLED";
}

export type TaskOutcome =
  | "spoke_with_elder"
  | "visited_in_person"
  | "self_resolved"
  | "unable_to_reach"
  | "handed_off";

export interface CareTask {
  id: string;
  careProfileId: string;
  sourceOccurrenceId: string;
  medicationName: string;
  doseText: string;
  scheduledTime: string;
  graceMinutesExpired: number;
  assignedToName: string;
  assignedToRole: string;
  assignedToEmail: string;
  status: "OPEN" | "CLAIMED" | "RESOLVED";
  claimedBy?: string;
  claimedAt?: string;
  resolutionOutcome?:
    | "spoke_with_elder"
    | "visited_in_person"
    | "self_resolved"
    | "unable_to_reach"
    | "handed_off";
  resolutionNote?: string;
  resolvedAt?: string;
  handedOffTo?: string;
  priority: "HIGH" | "MEDIUM" | "URGENT";
  createdAt: string;
}

export interface NotificationJob {
  id: string;
  dedupeKey: string;
  recipientEmail: string;
  recipientRole: string;
  type: "DOSE_DUE" | "MISSED_DOSE_ESCALATION" | "APPOINTMENT_REMINDER" | "TASK_CLAIMED";
  subject: string;
  bodyPreview: string;
  status: "DELIVERED" | "ACCEPTED" | "QUEUED" | "FAILED" | "CONFIG_REQUIRED";
  timestamp: string;
  retryCount?: number;
  providerError?: string;
}

export interface AuditEvent {
  id: string;
  careProfileId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: "DOSE" | "MEDICATION" | "TASK" | "APPOINTMENT" | "MEMBER";
  entityId: string;
  description: string;
  timestamp: string;
}

export interface DailyCareBrief {
  date: string;
  summaryText: string;
  takenCount: number;
  totalScheduled: number;
  unconfirmedCount: number;
  upcomingAppointments: string[];
  openTasksCount: number;
  generatedAt: string;
  isAiGrounded: boolean;
  sourceRecords: string[];
}

export interface RefillRunway {
  medicationId: string;
  medicationName: string;
  remainingQuantity: number;
  dailyConsumption: number;
  daysRemaining: number;
  estimatedRunOutDate: string;
  isLowStock: boolean;
}
