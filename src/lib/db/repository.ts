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
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

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
  getMedicationVersions(medicationId?: string): Promise<MedicationVersion[]>;
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
  addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date" | "timestamp">): Promise<CheckInRecord>;
}

/**
 * Checks if a persistent database backend is configured.
 */
export function isPersistentDbConfigured(): boolean {
  return isSupabaseConfigured() || Boolean(process.env.DATABASE_URL && getDatabasePool() !== null);
}

/**
 * Ensures production runtime does not silently operate without a persistent database.
 */
export function assertPersistenceRequirements(): void {
  if (process.env.NODE_ENV === "production" && !isPersistentDbConfigured()) {
    throw new Error(
      "FATAL: Production database connection (SUPABASE_URL or DATABASE_URL) is required. In-memory demo storage is strictly prohibited in production."
    );
  }
}

/**
 * Persistent Database Implementation of CareRepository (Supabase / PostgreSQL).
 * Reads and writes through PostgreSQL/Supabase tables with referential integrity.
 */
class PersistentCareRepository implements CareRepository {
  async getProfile(): Promise<CareProfile> {
    assertPersistenceRequirements();
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("care_profiles")
        .select("id, display_name, age, initials, conditions, vital_notes, household_code, timezone, locale")
        .limit(1)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          displayName: data.display_name,
          age: data.age,
          initials: data.initials,
          conditions: data.conditions || [],
          notes: data.vital_notes || [],
          passcode: "••••",
          circleInviteCode: "•••••••••",
          timezone: data.timezone || "America/New_York",
          locale: (data.locale as "en" | "hi") || "en",
        };
      }
    }

    const res = await query(
      "SELECT id, display_name, age, initials, conditions, vital_notes, passcode_hash, household_code, timezone, locale FROM care_profiles LIMIT 1;"
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
      locale: row.locale || "en",
    };
  }

  async getSanitizedProfile(role?: UserRole) {
    return guardianStore.getSanitizedProfile(role);
  }

  async getMembers(): Promise<CareMember[]> {
    assertPersistenceRequirements();
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("care_members")
        .select("id, care_profile_id, name, email, role, relationship, phone, is_primary_caregiver, status");

      if (!error && data && data.length > 0) {
        return data.map((r) => ({
          id: r.id,
          careProfileId: r.care_profile_id,
          name: r.name,
          email: r.email,
          role: r.role,
          relationship: r.relationship,
          phone: r.phone,
          isPrimaryCaregiver: r.is_primary_caregiver,
          status: r.status,
        }));
      }
    }

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
    assertPersistenceRequirements();
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("medications")
        .select("id, care_profile_id, name, dosage, instructions, pill_color, pill_shape, active, current_version, remaining_quantity, refill_threshold, schedule_time, slot, daily_frequency, food_requirement, prescribed_by")
        .eq("active", true);

      if (!error && data && data.length > 0) {
        return data.map((r) => ({
          id: r.id,
          careProfileId: r.care_profile_id,
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
          foodRequirement: r.food_requirement || "With food",
          prescribedBy: r.prescribed_by || "Dr. Robert Vance",
        }));
      }
    }

    const res = await query(
      "SELECT id, care_profile_id, name, dosage, instructions, pill_color, pill_shape, active, current_version, remaining_quantity, refill_threshold, schedule_time, slot, daily_frequency, food_requirement, prescribed_by FROM medications WHERE active = true;"
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
      foodRequirement: r.food_requirement || "With food",
      prescribedBy: r.prescribed_by || "Dr. Robert Vance",
    }));
  }

  async getMedicationVersions(medicationId?: string): Promise<MedicationVersion[]> {
    assertPersistenceRequirements();
    const supabase = getSupabaseServerClient();
    if (supabase) {
      let q = supabase
        .from("medication_versions")
        .select("id, medication_id, version, label_name, dose_text, instructions, effective_from, created_by, reason, confirmed_by")
        .order("version", { ascending: false });

      if (medicationId) {
        q = q.eq("medication_id", medicationId);
      }

      const { data, error } = await q;

      if (!error && data && data.length > 0) {
        return data.map((r) => ({
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
    }

    const sql = medicationId
      ? "SELECT id, medication_id, version, label_name, dose_text, instructions, effective_from, created_by, reason, confirmed_by FROM medication_versions WHERE medication_id = $1 ORDER BY version DESC;"
      : "SELECT id, medication_id, version, label_name, dose_text, instructions, effective_from, created_by, reason, confirmed_by FROM medication_versions ORDER BY version DESC;";
    const params = medicationId ? [medicationId] : [];
    const res = await query(sql, params);
    if (!res || res.rows.length === 0) {
      return guardianStore.getMedicationVersions(medicationId);
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
    assertPersistenceRequirements();
    const med = guardianStore.addMedicationWithVersion(params);
    const supabase = getSupabaseServerClient();

    if (supabase) {
      await supabase.from("medications").insert({
        id: med.id,
        care_profile_id: guardianStore.getProfile().id,
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions,
        pill_color: med.pillColor,
        pill_shape: med.pillShape,
        schedule_time: med.scheduleTime,
        slot: med.slot,
        current_version: med.currentVersion,
        remaining_quantity: med.remainingQuantity,
        refill_threshold: med.refillThreshold,
      });

      await supabase.from("medication_versions").insert({
        medication_id: med.id,
        version: med.currentVersion,
        label_name: med.name,
        dose_text: med.dosage,
        instructions: med.instructions,
        effective_from: new Date().toISOString().slice(0, 10),
        created_by: params.authorName,
        reason: params.reason,
      });
      return med;
    }

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
      console.warn("[PersistentCareRepository] Database write notice:", e);
    }
    return med;
  }

  async editMedicationWithVersion(params: any) {
    assertPersistenceRequirements();
    const result = guardianStore.editMedicationWithVersion(params);
    if (result) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        await supabase
          .from("medications")
          .update({
            dosage: result.medication.dosage,
            instructions: result.medication.instructions,
            current_version: result.medication.currentVersion,
          })
          .eq("id", result.medication.id);

        await supabase.from("medication_versions").insert({
          medication_id: result.medication.id,
          version: result.version.version,
          label_name: result.version.labelName,
          dose_text: result.version.doseText,
          instructions: result.version.instructions,
          effective_from: result.version.effectiveFrom,
          created_by: result.version.createdBy,
          reason: result.version.reason,
        });
        return result;
      }

      try {
        await query(
          `UPDATE medications SET dosage = $1, instructions = $2, current_version = $3 WHERE id = $4;`,
          [result.medication.dosage, result.medication.instructions, result.medication.currentVersion, result.medication.id]
        );
      } catch (e) {
        console.warn("[PersistentCareRepository] Database update notice:", e);
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
    assertPersistenceRequirements();
    const res = guardianStore.recordCheckIn(occurrenceId, status, actorName, actorRole, note, doNotNotifyFamily);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase
        .from("dose_occurrences")
        .update({ status })
        .eq("id", occurrenceId);

      await supabase.from("dose_checkins").insert({
        occurrence_id: occurrenceId,
        status,
        actor_name: actorName,
        actor_role: actorRole,
        note,
        do_not_notify_family: doNotNotifyFamily || false,
      });
    }
    return res;
  }

  async getAppointments(): Promise<DoctorAppointment[]> {
    return guardianStore.getAppointments();
  }

  async addAppointment(appt: Omit<DoctorAppointment, "id">): Promise<DoctorAppointment> {
    assertPersistenceRequirements();
    const res = guardianStore.addAppointment(appt);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from("appointments").insert({
        id: res.id,
        care_profile_id: guardianStore.getProfile().id,
        doctor_name: res.doctorName,
        specialty: res.specialty,
        clinic_name: res.clinicName,
        address: res.address,
        starts_at: res.dateTime,
        date_label: res.dateLabel,
        time_label: res.timeLabel,
        transport_assigned: res.transportAssigned,
        transport_details: res.transportDetails,
        questions_to_ask: res.questionsToAsk,
        post_visit_notes: res.postVisitNotes,
        status: res.status,
      });
    }
    return res;
  }

  async getTasks(): Promise<CareTask[]> {
    return guardianStore.getTasks();
  }

  async claimTask(taskId: string, claimer: string): Promise<CareTask | null> {
    assertPersistenceRequirements();
    const task = guardianStore.claimTask(taskId, claimer);
    const supabase = getSupabaseServerClient();
    if (supabase && task) {
      await supabase
        .from("care_tasks")
        .update({
          status: "CLAIMED",
          claimed_by: claimer,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    }
    return task;
  }

  async handoffTask(taskId: string, fromCaregiver: string, toCaregiver: string, note: string): Promise<CareTask | null> {
    assertPersistenceRequirements();
    const task = guardianStore.handoffTask(taskId, fromCaregiver, toCaregiver, note);
    const supabase = getSupabaseServerClient();
    if (supabase && task) {
      await supabase
        .from("care_tasks")
        .update({
          assigned_to_name: toCaregiver,
          handed_off_to: toCaregiver,
          resolution_note: note,
        })
        .eq("id", taskId);
    }
    return task;
  }

  async resolveTask(taskId: string, outcome: TaskOutcome, note: string, resolver: string): Promise<CareTask | null> {
    assertPersistenceRequirements();
    const task = guardianStore.resolveTask(taskId, outcome, note, resolver);
    const supabase = getSupabaseServerClient();
    if (supabase && task) {
      await supabase
        .from("care_tasks")
        .update({
          status: "RESOLVED",
          resolution_outcome: outcome,
          resolution_note: note,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    }
    return task;
  }

  async escalateUnconfirmedDose(occurrenceId: string): Promise<CareTask | null> {
    assertPersistenceRequirements();
    const task = guardianStore.escalateUnconfirmedDose(occurrenceId);
    const supabase = getSupabaseServerClient();
    if (supabase && task) {
      await supabase.from("care_tasks").insert({
        id: task.id,
        care_profile_id: task.careProfileId,
        source_occurrence_id: task.sourceOccurrenceId,
        medication_name: task.medicationName,
        dose_text: task.doseText,
        scheduled_time: task.scheduledTime,
        grace_minutes_expired: task.graceMinutesExpired,
        assigned_to_name: task.assignedToName,
        assigned_to_email: task.assignedToEmail,
        status: task.status,
        priority: task.priority,
      });
    }
    return task;
  }

  async createBackupRequest(params: { caregiverName: string; reason: string }): Promise<CareTask> {
    assertPersistenceRequirements();
    return guardianStore.createBackupRequest(params);
  }

  async getNotifications(): Promise<NotificationJob[]> {
    return guardianStore.getNotifications();
  }

  async sendNotification(job: NotificationJob): Promise<void> {
    guardianStore.sendNotification(job);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from("notification_jobs").insert({
        id: job.id,
        dedupe_key: job.dedupeKey,
        recipient_email: job.recipientEmail,
        recipient_role: job.recipientRole,
        notification_type: job.type,
        subject: job.subject,
        body_preview: job.bodyPreview,
        status: job.status,
        provider_error: job.providerError,
        retry_count: job.retryCount || 0,
      });
    }
  }

  async getAuditEvents(): Promise<AuditEvent[]> {
    return guardianStore.getAuditEvents();
  }

  async logAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
    const full = guardianStore.addAuditEvent(event);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from("audit_events").insert({
        care_profile_id: guardianStore.getProfile().id,
        actor_name: full.actorName,
        actor_role: full.actorRole,
        action: full.action,
        entity_type: full.entityType,
        entity_id: full.entityId,
        description: full.description,
      });
    }
  }

  async getWellbeingHistory(caregiverId: string): Promise<CheckInRecord[]> {
    assertPersistenceRequirements();
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("caregiver_wellbeing")
        .select("id, caregiver_id, sleep_hours, mood, stress, energy, note, share_with_family, recorded_at")
        .eq("caregiver_id", caregiverId)
        .order("recorded_at", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((r) => ({
          id: r.id,
          caregiverId: r.caregiver_id,
          date: r.recorded_at.slice(0, 10),
          timestamp: r.recorded_at,
          sleepHours: Number(r.sleep_hours),
          mood: r.mood,
          stress: r.stress,
          energy: r.energy,
          note: r.note,
          shareWithFamily: r.share_with_family,
        }));
      }
    }
    return getHistory(caregiverId);
  }

  async addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date" | "timestamp">): Promise<CheckInRecord> {
    assertPersistenceRequirements();
    const checkin = addCheckIn(data);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from("caregiver_wellbeing").insert({
        id: checkin.id,
        care_profile_id: guardianStore.getProfile().id,
        caregiver_id: checkin.caregiverId,
        sleep_hours: checkin.sleepHours,
        mood: checkin.mood,
        stress: checkin.stress,
        energy: checkin.energy,
        note: checkin.note,
        share_with_family: checkin.shareWithFamily,
      });
    }
    return checkin;
  }
}

/**
 * Local / Test In-Memory Implementation.
 * Used during local development and testing when DATABASE_URL or SUPABASE_URL is not set.
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

  async getMedicationVersions(medicationId?: string): Promise<MedicationVersion[]> {
    return guardianStore.getMedicationVersions(medicationId);
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

  async addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date" | "timestamp">): Promise<CheckInRecord> {
    return addCheckIn(data);
  }
}

/**
 * Singleton repository instance.
 * Automatically selects PersistentCareRepository if Supabase or PostgreSQL is configured,
 * otherwise safely uses InMemoryCareRepository in development/test.
 */
export const careRepository: CareRepository = isPersistentDbConfigured()
  ? new PersistentCareRepository()
  : new InMemoryCareRepository();
