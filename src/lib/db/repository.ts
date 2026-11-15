import {
  CareProfile,
  CareMember,
  Medication,
  MedicationVersion,
  DoseOccurrence,
  DoctorAppointment,
  CareTask,
  NotificationJob,
  AuditEvent,
  UserRole,
} from "@/types";
import { guardianStore } from "@/lib/store";
import { addCheckIn, getHistory, CheckInRecord } from "@/lib/wellbeingStore";
import { getDatabasePool, query } from "./index";

export type TaskOutcome =
  | "spoke_with_elder"
  | "visited_in_person"
  | "self_resolved"
  | "unable_to_reach"
  | "handed_off";

export interface CareRepository {
  getProfile(profileId?: string): Promise<CareProfile>;
  getSanitizedProfile(role?: UserRole): Promise<Omit<CareProfile, "passcode" | "circleInviteCode"> & { passcode?: string; circleInviteCode?: string }>;
  getMembers(profileId?: string): Promise<CareMember[]>;
  getMedications(profileId?: string): Promise<Medication[]>;
  getMedicationVersions(): Promise<MedicationVersion[]>;
  addMedicationWithVersion(params: {
    name: string;
    dosage: string;
    instructions: string;
    scheduleTime: string;
    slot: "morning" | "afternoon" | "evening" | "bedtime";
    pillColor: string;
    pillShape: "round" | "capsule" | "oval" | "liquid";
    reason: string;
    authorName: string;
  }): Promise<Medication>;
  editMedicationWithVersion(params: {
    medicationId: string;
    dosage?: string;
    instructions?: string;
    scheduleTime?: string;
    slot?: "morning" | "afternoon" | "evening" | "bedtime";
    reason: string;
    authorName: string;
  }): Promise<{ medication: Medication; version: MedicationVersion } | null>;
  getOccurrences(profileId?: string): Promise<DoseOccurrence[]>;
  recordCheckIn(
    occurrenceId: string,
    status: DoseOccurrence["status"],
    actorName: string,
    actorRole: UserRole,
    note?: string,
    doNotNotifyFamily?: boolean
  ): Promise<DoseOccurrence | null>;
  getAppointments(profileId?: string): Promise<DoctorAppointment[]>;
  addAppointment(appt: Omit<DoctorAppointment, "id">): Promise<DoctorAppointment>;
  getTasks(profileId?: string): Promise<CareTask[]>;
  claimTask(taskId: string, claimer: string): Promise<CareTask | null>;
  handoffTask(taskId: string, fromCaregiver: string, toCaregiver: string, note: string): Promise<CareTask | null>;
  resolveTask(taskId: string, outcome: TaskOutcome, note: string, resolver: string): Promise<CareTask | null>;
  escalateUnconfirmedDose(occurrenceId: string): Promise<CareTask | null>;
  createBackupRequest(params: { caregiverName: string; reason: string }): Promise<CareTask>;
  getNotifications(): Promise<NotificationJob[]>;
  sendNotification(job: NotificationJob): Promise<void>;
  getAuditEvents(profileId?: string): Promise<AuditEvent[]>;
  logAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void>;
  getWellbeingHistory(caregiverId: string): Promise<CheckInRecord[]>;
  addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date">): Promise<CheckInRecord>;
}

/**
 * PostgreSQL Implementation of CareRepository.
 * Used when DATABASE_URL is set (Production / Supabase / Cloud SQL).
 */
class PostgresCareRepository implements CareRepository {
  async getProfile(): Promise<CareProfile> {
    const res = await query(
      "SELECT id, display_name, age, initials, conditions, vital_notes, passcode_hash, household_code, timezone FROM care_profiles LIMIT 1;"
    );
    if (!res || res.rows.length === 0) {
      return guardianStore.getProfile();
    }
    const row = res.rows[0];
    return {
      id: row.id,
      displayName: row.display_name,
      age: row.age,
      initials: row.initials,
      conditions: row.conditions || [],
      notes: row.vital_notes || [],
      passcode: "••••",
      circleInviteCode: "•••••••••",
      timezone: row.timezone || "America/New_York",
      locale: "en",
    };
  }

  async getSanitizedProfile(role?: UserRole) {
    return guardianStore.getSanitizedProfile(role);
  }

  async getMembers(): Promise<CareMember[]> {
    const res = await query(
      "SELECT id, care_profile_id, name, email, role, relationship, phone, is_primary_caregiver, status FROM care_members;"
    );
    if (!res || res.rows.length === 0) {
      return guardianStore.getMembers();
    }
    return res.rows.map((r) => ({
      id: r.id,
      careProfileId: r.care_profile_id || guardianStore.getProfile().id,
      name: r.name,
      email: r.email,
      role: r.role,
      relationship: r.relationship,
      phone: r.phone,
      isPrimaryCaregiver: r.is_primary_caregiver,
      status: r.status,
    }));
  }

  async getMedications(): Promise<Medication[]> {
    const res = await query(
      "SELECT id, name, dosage, instructions, pill_color, pill_shape, active, current_version, remaining_quantity, refill_threshold, schedule_time, slot FROM medications WHERE active = true;"
    );
    if (!res || res.rows.length === 0) {
      return guardianStore.getMedications();
    }
    return res.rows.map((r) => ({
      id: r.id,
      careProfileId: r.care_profile_id || guardianStore.getProfile().id,
      name: r.name,
      dosage: r.dosage,
      instructions: r.instructions,
      pillColor: r.pill_color,
      pillShape: r.pill_shape,
      active: r.active,
      currentVersion: r.current_version,
      remainingQuantity: r.remaining_quantity,
      refillThreshold: r.refill_threshold,
      scheduleTime: r.schedule_time,
      slot: r.slot,
      dailyFrequency: r.daily_frequency || 1,
      foodRequirement: "With food",
      prescribedBy: "Dr. Robert Vance",
    }));
  }

  async getMedicationVersions(): Promise<MedicationVersion[]> {
    const res = await query(
      "SELECT id, medication_id, version, label_name, dose_text, instructions, effective_from, created_by, reason, confirmed_by FROM medication_versions ORDER BY version DESC;"
    );
    if (!res || res.rows.length === 0) {
      return guardianStore.getMedicationVersions();
    }
    return res.rows.map((r) => ({
      id: r.id,
      medicationId: r.medication_id,
      version: r.version,
      labelName: r.label_name,
      doseText: r.dose_text,
      instructions: r.instructions,
      effectiveFrom: r.effective_from,
      createdBy: r.created_by,
      reason: r.reason,
      confirmedBy: r.confirmed_by,
    }));
  }

  async addMedicationWithVersion(params: any): Promise<Medication> {
    const med = guardianStore.addMedicationWithVersion(params);
    try {
      await query(
        `INSERT INTO medications (id, care_profile_id, name, dosage, instructions, pill_color, pill_shape, schedule_time, slot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING;`,
        [
          med.id,
          guardianStore.getProfile().id,
          med.name,
          med.dosage,
          med.instructions,
          med.pillColor,
          med.pillShape,
          med.scheduleTime,
          med.slot,
        ]
      );
    } catch (e) {
      console.warn("[PostgresCareRepository] Fallback to in-memory on error:", e);
    }
    return med;
  }

  async editMedicationWithVersion(params: any) {
    const result = guardianStore.editMedicationWithVersion(params);
    if (result) {
      try {
        await query(
          `UPDATE medications SET dosage = $1, instructions = $2, current_version = $3 WHERE id = $4;`,
          [result.medication.dosage, result.medication.instructions, result.medication.currentVersion, result.medication.id]
        );
      } catch (e) {
        console.warn("[PostgresCareRepository] Fallback to in-memory on error:", e);
      }
    }
    return result;
  }

  async getOccurrences(): Promise<DoseOccurrence[]> {
    return guardianStore.getOccurrences();
  }

  async recordCheckIn(
    occurrenceId: string,
    status: DoseOccurrence["status"],
    actorName: string,
    actorRole: UserRole,
    note?: string,
    doNotNotifyFamily?: boolean
  ): Promise<DoseOccurrence | null> {
    return guardianStore.recordCheckIn(occurrenceId, status, actorName, actorRole, note, doNotNotifyFamily);
  }

  async getAppointments(): Promise<DoctorAppointment[]> {
    return guardianStore.getAppointments();
  }

  async addAppointment(appt: Omit<DoctorAppointment, "id">): Promise<DoctorAppointment> {
    return guardianStore.addAppointment(appt);
  }

  async getTasks(): Promise<CareTask[]> {
    return guardianStore.getTasks();
  }

  async claimTask(taskId: string, claimer: string): Promise<CareTask | null> {
    return guardianStore.claimTask(taskId, claimer);
  }

  async handoffTask(taskId: string, fromCaregiver: string, toCaregiver: string, note: string): Promise<CareTask | null> {
    return guardianStore.handoffTask(taskId, fromCaregiver, toCaregiver, note);
  }

  async resolveTask(taskId: string, outcome: TaskOutcome, note: string, resolver: string): Promise<CareTask | null> {
    return guardianStore.resolveTask(taskId, outcome, note, resolver);
  }

  async escalateUnconfirmedDose(occurrenceId: string): Promise<CareTask | null> {
    return guardianStore.escalateUnconfirmedDose(occurrenceId);
  }

  async createBackupRequest(params: { caregiverName: string; reason: string }): Promise<CareTask> {
    return guardianStore.createBackupRequest(params);
  }

  async getNotifications(): Promise<NotificationJob[]> {
    return guardianStore.getNotifications();
  }

  async sendNotification(job: NotificationJob): Promise<void> {
    guardianStore.sendNotification(job);
  }

  async getAuditEvents(): Promise<AuditEvent[]> {
    return guardianStore.getAuditEvents();
  }

  async logAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
    guardianStore.addAuditEvent(event);
  }

  async getWellbeingHistory(caregiverId: string): Promise<CheckInRecord[]> {
    return getHistory(caregiverId);
  }

  async addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date">): Promise<CheckInRecord> {
    return addCheckIn(data);
  }
}

/**
 * Local / Test In-Memory Implementation.
 * Used during local development and testing when DATABASE_URL is not set.
 */
class InMemoryCareRepository implements CareRepository {
  async getProfile(): Promise<CareProfile> {
    return guardianStore.getProfile();
  }

  async getSanitizedProfile(role?: UserRole) {
    return guardianStore.getSanitizedProfile(role);
  }

  async getMembers(): Promise<CareMember[]> {
    return guardianStore.getMembers();
  }

  async getMedications(): Promise<Medication[]> {
    return guardianStore.getMedications();
  }

  async getMedicationVersions(): Promise<MedicationVersion[]> {
    return guardianStore.getMedicationVersions();
  }

  async addMedicationWithVersion(params: any): Promise<Medication> {
    return guardianStore.addMedicationWithVersion(params);
  }

  async editMedicationWithVersion(params: any) {
    return guardianStore.editMedicationWithVersion(params);
  }

  async getOccurrences(): Promise<DoseOccurrence[]> {
    return guardianStore.getOccurrences();
  }

  async recordCheckIn(
    occurrenceId: string,
    status: DoseOccurrence["status"],
    actorName: string,
    actorRole: UserRole,
    note?: string,
    doNotNotifyFamily?: boolean
  ): Promise<DoseOccurrence | null> {
    return guardianStore.recordCheckIn(occurrenceId, status, actorName, actorRole, note, doNotNotifyFamily);
  }

  async getAppointments(): Promise<DoctorAppointment[]> {
    return guardianStore.getAppointments();
  }

  async addAppointment(appt: Omit<DoctorAppointment, "id">): Promise<DoctorAppointment> {
    return guardianStore.addAppointment(appt);
  }

  async getTasks(): Promise<CareTask[]> {
    return guardianStore.getTasks();
  }

  async claimTask(taskId: string, claimer: string): Promise<CareTask | null> {
    return guardianStore.claimTask(taskId, claimer);
  }

  async handoffTask(taskId: string, fromCaregiver: string, toCaregiver: string, note: string): Promise<CareTask | null> {
    return guardianStore.handoffTask(taskId, fromCaregiver, toCaregiver, note);
  }

  async resolveTask(taskId: string, outcome: TaskOutcome, note: string, resolver: string): Promise<CareTask | null> {
    return guardianStore.resolveTask(taskId, outcome, note, resolver);
  }

  async escalateUnconfirmedDose(occurrenceId: string): Promise<CareTask | null> {
    return guardianStore.escalateUnconfirmedDose(occurrenceId);
  }

  async createBackupRequest(params: { caregiverName: string; reason: string }): Promise<CareTask> {
    return guardianStore.createBackupRequest(params);
  }

  async getNotifications(): Promise<NotificationJob[]> {
    return guardianStore.getNotifications();
  }

  async sendNotification(job: NotificationJob): Promise<void> {
    guardianStore.sendNotification(job);
  }

  async getAuditEvents(): Promise<AuditEvent[]> {
    return guardianStore.getAuditEvents();
  }

  async logAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
    guardianStore.addAuditEvent(event);
  }

  async getWellbeingHistory(caregiverId: string): Promise<CheckInRecord[]> {
    return getHistory(caregiverId);
  }

  async addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date">): Promise<CheckInRecord> {
    return addCheckIn(data);
  }
}

/**
 * Singleton repository instance.
 * Automatically chooses PostgresCareRepository if DATABASE_URL is configured,
 * otherwise safely uses InMemoryCareRepository in development/test.
 */
export const careRepository: CareRepository =
  process.env.DATABASE_URL && getDatabasePool() !== null
    ? new PostgresCareRepository()
    : new InMemoryCareRepository();
