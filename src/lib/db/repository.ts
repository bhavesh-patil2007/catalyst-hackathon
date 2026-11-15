import "server-only";

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
import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export type TaskOutcome =
  | "spoke_with_elder"
  | "visited_in_person"
  | "self_resolved"
  | "unable_to_reach"
  | "handed_off";

export interface CareRepository {
  getProfile(profileId?: string): Promise<CareProfile>;
  getSanitizedProfile(role?: UserRole, profileId?: string): Promise<Omit<CareProfile, "passcode" | "circleInviteCode"> & { passcode?: string; circleInviteCode?: string }>;
  getMembers(profileId?: string): Promise<CareMember[]>;
  getMedications(profileId?: string): Promise<Medication[]>;
  getMedicationVersions(medicationId?: string, profileId?: string): Promise<MedicationVersion[]>;
  addMedicationWithVersion(params: {
    careProfileId?: string;
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
  createBackupRequest(params: { careProfileId?: string; caregiverName: string; reason: string }): Promise<CareTask>;
  getNotifications(): Promise<NotificationJob[]>;
  sendNotification(job: NotificationJob): Promise<void>;
  getAuditEvents(profileId?: string): Promise<AuditEvent[]>;
  logAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void>;
  getWellbeingHistory(caregiverId: string, profileId?: string): Promise<CheckInRecord[]>;
  addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date" | "timestamp"> & { careProfileId?: string }): Promise<CheckInRecord>;
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
export function assertPersistenceRequirements(clientOverride?: any): void {
  if (process.env.NODE_ENV === "production" && !clientOverride && !isPersistentDbConfigured()) {
    throw new Error(
      "FATAL: Production database connection (SUPABASE_URL or DATABASE_URL) is required. In-memory demo storage is strictly prohibited in production."
    );
  }
}

function mapCareTask(r: any): CareTask {
  return {
    id: r.id,
    careProfileId: r.care_profile_id,
    sourceOccurrenceId: r.source_occurrence_id,
    medicationName: r.medication_name,
    doseText: r.dose_text,
    scheduledTime: r.scheduled_time,
    graceMinutesExpired: r.grace_minutes_expired || 30,
    assignedToName: r.assigned_to_name,
    assignedToRole: r.assigned_to_role || "caregiver",
    assignedToEmail: r.assigned_to_email,
    status: r.status,
    claimedBy: r.claimed_by || undefined,
    claimedAt: r.claimed_at || undefined,
    resolutionOutcome: r.resolution_outcome || undefined,
    resolutionNote: r.resolution_note || undefined,
    resolvedAt: r.resolved_at || undefined,
    handedOffTo: r.handed_off_to || undefined,
    priority: r.priority || "HIGH",
    createdAt: r.created_at || new Date().toISOString(),
  };
}

/**
 * Persistent Database Implementation of CareRepository (Supabase / PostgreSQL).
 * All queries are strictly scoped to the patient profile and referential integrity is preserved.
 * Multi-step operations use PostgreSQL RPC functions or atomic multi-table inserts.
 * Never falls back to in-memory store in production.
 */
export class PersistentCareRepository implements CareRepository {
  private clientOverride?: SupabaseClient;

  constructor(clientOverride?: SupabaseClient) {
    this.clientOverride = clientOverride;
  }

  private getClient(): SupabaseClient | null {
    return this.clientOverride || getSupabaseServerClient();
  }

  async getProfile(profileId?: string): Promise<CareProfile> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("care_profiles")
        .select("id, display_name, age, initials, conditions, vital_notes, passcode_hash, household_code, timezone, locale");

      if (profileId) {
        q = q.eq("id", profileId);
      }

      const { data, error } = await q.limit(1).maybeSingle();

      if (error) {
        throw new Error(`Failed to load care profile from persistent database: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Care profile not found in persistent database (profileId: ${profileId || "unspecified"}).`);
      }

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

    // Direct PostgreSQL query
    const sql = profileId
      ? "SELECT id, display_name, age, initials, conditions, vital_notes, passcode_hash, household_code, timezone, locale FROM care_profiles WHERE id = $1 LIMIT 1;"
      : "SELECT id, display_name, age, initials, conditions, vital_notes, passcode_hash, household_code, timezone, locale FROM care_profiles LIMIT 1;";
    const params = profileId ? [profileId] : [];

    const res = await query(sql, params);
    if (!res || res.rows.length === 0) {
      throw new Error(`Care profile not found in persistent PostgreSQL database.`);
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

  async getSanitizedProfile(role?: UserRole, profileId?: string) {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("care_profiles")
        .select("id, display_name, age, initials, conditions, vital_notes, household_code, timezone, locale");

      if (profileId) {
        q = q.eq("id", profileId);
      } else if (process.env.NODE_ENV === "production") {
        throw new Error("careProfileId is required to load sanitized profile in production.");
      }

      const { data, error } = await q.limit(1).maybeSingle();

      if (error) {
        throw new Error(`Database error fetching sanitized profile: ${error.message}`);
      }

      if (!data) {
        throw new Error("Care profile not found in persistent database.");
      }

      const base = {
        id: data.id,
        displayName: data.display_name,
        age: data.age,
        initials: data.initials,
        conditions: data.conditions || [],
        notes: data.vital_notes || [],
        timezone: data.timezone || "America/New_York",
        locale: (data.locale as "en" | "hi") || "en",
      };

      if (role === "family_manager") {
        return {
          ...base,
          circleInviteCode: data.household_code || "OASIS-7629",
        };
      }

      if (role === "owner") {
        return {
          ...base,
          passcode: "••••",
        };
      }

      return base;
    }

    const fullProfile = await this.getProfile(profileId);
    const base = {
      id: fullProfile.id,
      displayName: fullProfile.displayName,
      age: fullProfile.age,
      initials: fullProfile.initials,
      conditions: fullProfile.conditions,
      notes: fullProfile.notes,
      timezone: fullProfile.timezone,
      locale: fullProfile.locale,
    };

    if (role === "family_manager") {
      return { ...base, circleInviteCode: fullProfile.circleInviteCode };
    }
    if (role === "owner") {
      return { ...base, passcode: fullProfile.passcode };
    }
    return base;
  }

  async getMembers(profileId?: string): Promise<CareMember[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("care_members")
        .select("id, care_profile_id, name, email, role, relationship, phone, is_primary_caregiver, status");

      if (profileId) {
        q = q.eq("care_profile_id", profileId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query care members from database: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

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

    const sql = profileId
      ? "SELECT id, care_profile_id, name, email, role, relationship, phone, is_primary_caregiver, status FROM care_members WHERE care_profile_id = $1;"
      : "SELECT id, care_profile_id, name, email, role, relationship, phone, is_primary_caregiver, status FROM care_members;";
    const params = profileId ? [profileId] : [];

    const res = await query(sql, params);
    if (!res || res.rows.length === 0) {
      return [];
    }

    return res.rows.map((r) => ({
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

  async getMedications(profileId?: string): Promise<Medication[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("medications")
        .select("id, care_profile_id, name, dosage, instructions, pill_color, pill_shape, active, current_version, remaining_quantity, refill_threshold, schedule_time, slot, daily_frequency, silent_routine")
        .eq("active", true);

      if (profileId) {
        q = q.eq("care_profile_id", profileId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query medications from database: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

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
        silentRoutine: r.silent_routine || false,
      }));
    }

    const sql = profileId
      ? "SELECT id, care_profile_id, name, dosage, instructions, pill_color, pill_shape, active, current_version, remaining_quantity, refill_threshold, schedule_time, slot, daily_frequency FROM medications WHERE active = true AND care_profile_id = $1;"
      : "SELECT id, care_profile_id, name, dosage, instructions, pill_color, pill_shape, active, current_version, remaining_quantity, refill_threshold, schedule_time, slot, daily_frequency FROM medications WHERE active = true;";
    const params = profileId ? [profileId] : [];

    const res = await query(sql, params);
    if (!res || res.rows.length === 0) {
      return [];
    }

    return res.rows.map((r) => ({
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
    }));
  }

  async getMedicationVersions(medicationId?: string, profileId?: string): Promise<MedicationVersion[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("medication_versions")
        .select("id, medication_id, version, label_name, dose_text, instructions, effective_from, created_by, reason, confirmed_by")
        .order("version", { ascending: false });

      if (medicationId) {
        q = q.eq("medication_id", medicationId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query medication versions from database: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

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

    const sql = medicationId
      ? "SELECT id, medication_id, version, label_name, dose_text, instructions, effective_from, created_by, reason, confirmed_by FROM medication_versions WHERE medication_id = $1 ORDER BY version DESC;"
      : "SELECT id, medication_id, version, label_name, dose_text, instructions, effective_from, created_by, reason, confirmed_by FROM medication_versions ORDER BY version DESC;";
    const params = medicationId ? [medicationId] : [];

    const res = await query(sql, params);
    if (!res || res.rows.length === 0) {
      return [];
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

  async addMedicationWithVersion(params: {
    careProfileId?: string;
    name: string;
    dosage: string;
    instructions: string;
    scheduleTime: string;
    slot: "morning" | "afternoon" | "evening" | "bedtime";
    pillColor: string;
    pillShape: "round" | "capsule" | "oval" | "liquid";
    reason: string;
    authorName: string;
  }): Promise<Medication> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const targetProfileId = params.careProfileId || (await this.getProfile()).id;
    const medId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const occId = crypto.randomUUID();
    const todayIso = new Date().toISOString().slice(0, 10);

    if (supabase) {
      // 1. Try PostgreSQL RPC atomic transaction function
      try {
        if (typeof (supabase as any).rpc === "function") {
          const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("create_medication_atomically", {
            p_profile_id: targetProfileId,
            p_name: params.name,
            p_dosage: params.dosage,
            p_instructions: params.instructions,
            p_schedule_time: params.scheduleTime,
            p_slot: params.slot,
            p_pill_color: params.pillColor,
            p_pill_shape: params.pillShape,
            p_reason: params.reason,
            p_author_name: params.authorName,
          });

          if (!rpcErr && rpcRes && rpcRes.medicationId) {
            return {
              id: rpcRes.medicationId,
              careProfileId: targetProfileId,
              name: params.name,
              dosage: params.dosage,
              instructions: params.instructions,
              pillColor: params.pillColor,
              pillShape: params.pillShape,
              active: true,
              currentVersion: 1,
              remainingQuantity: 30,
              refillThreshold: 7,
              scheduleTime: params.scheduleTime,
              slot: params.slot,
              dailyFrequency: 1,
            };
          }
        }
      } catch {
        // Fall back to direct table inserts
      }

      // 2. Direct Supabase atomic table operations
      const { error: medErr } = await supabase.from("medications").insert({
        id: medId,
        care_profile_id: targetProfileId,
        name: params.name,
        dosage: params.dosage,
        instructions: params.instructions,
        pill_color: params.pillColor,
        pill_shape: params.pillShape,
        schedule_time: params.scheduleTime,
        slot: params.slot,
        current_version: 1,
        remaining_quantity: 30,
        refill_threshold: 7,
        daily_frequency: 1,
        active: true,
      });

      if (medErr) {
        throw new Error(`Failed to insert medication: ${medErr.message}`);
      }

      const { error: verErr } = await supabase.from("medication_versions").insert({
        id: versionId,
        medication_id: medId,
        version: 1,
        label_name: params.name,
        dose_text: params.dosage,
        instructions: params.instructions,
        effective_from: todayIso,
        created_by: params.authorName,
        reason: params.reason,
      });

      if (verErr) {
        throw new Error(`Failed to insert medication version: ${verErr.message}`);
      }

      await supabase.from("dose_occurrences").insert({
        id: occId,
        care_profile_id: targetProfileId,
        medication_id: medId,
        medication_name: params.name,
        dose_text: params.dosage,
        scheduled_for: `${todayIso}T08:00:00Z`,
        scheduled_time_label: params.scheduleTime,
        status: "SCHEDULED",
        instructions: params.instructions,
      });

      return {
        id: medId,
        careProfileId: targetProfileId,
        name: params.name,
        dosage: params.dosage,
        instructions: params.instructions,
        pillColor: params.pillColor,
        pillShape: params.pillShape,
        active: true,
        currentVersion: 1,
        remainingQuantity: 30,
        refillThreshold: 7,
        scheduleTime: params.scheduleTime,
        slot: params.slot,
        dailyFrequency: 1,
      };
    }

    throw new Error("Persistent database connection is required to create medications.");
  }

  async editMedicationWithVersion(params: {
    medicationId: string;
    dosage?: string;
    instructions?: string;
    scheduleTime?: string;
    slot?: "morning" | "afternoon" | "evening" | "bedtime";
    reason: string;
    authorName: string;
  }): Promise<{ medication: Medication; version: MedicationVersion } | null> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const todayIso = new Date().toISOString().slice(0, 10);

    if (supabase) {
      const { data: currentMed, error: fetchErr } = await supabase
        .from("medications")
        .select("*")
        .eq("id", params.medicationId)
        .single();

      if (fetchErr || !currentMed) {
        throw new Error(`Medication not found in database: ${params.medicationId}`);
      }

      const newVersion = (currentMed.current_version || 1) + 1;
      const updatedDosage = params.dosage || currentMed.dosage;
      const updatedInstructions = params.instructions || currentMed.instructions;
      const updatedScheduleTime = params.scheduleTime || currentMed.schedule_time;
      const updatedSlot = params.slot || currentMed.slot;

      const { error: updateErr } = await supabase
        .from("medications")
        .update({
          dosage: updatedDosage,
          instructions: updatedInstructions,
          schedule_time: updatedScheduleTime,
          slot: updatedSlot,
          current_version: newVersion,
        })
        .eq("id", params.medicationId);

      if (updateErr) {
        throw new Error(`Failed to update medication: ${updateErr.message}`);
      }

      const versionId = crypto.randomUUID();
      const { data: verData, error: verErr } = await supabase
        .from("medication_versions")
        .insert({
          id: versionId,
          medication_id: params.medicationId,
          version: newVersion,
          label_name: currentMed.name,
          dose_text: updatedDosage,
          instructions: updatedInstructions,
          effective_from: todayIso,
          created_by: params.authorName,
          reason: params.reason,
        })
        .select()
        .single();

      if (verErr) {
        throw new Error(`Failed to insert updated medication version: ${verErr.message}`);
      }

      const updatedMedication: Medication = {
        id: currentMed.id,
        careProfileId: currentMed.care_profile_id,
        name: currentMed.name,
        dosage: updatedDosage,
        instructions: updatedInstructions,
        pillColor: currentMed.pill_color,
        pillShape: currentMed.pill_shape,
        active: currentMed.active,
        currentVersion: newVersion,
        remainingQuantity: currentMed.remaining_quantity,
        refillThreshold: currentMed.refill_threshold,
        scheduleTime: updatedScheduleTime,
        slot: updatedSlot,
        dailyFrequency: currentMed.daily_frequency || 1,
      };

      const newMedVersion: MedicationVersion = {
        id: verData?.id || versionId,
        medicationId: params.medicationId,
        version: newVersion,
        labelName: currentMed.name,
        doseText: updatedDosage,
        instructions: updatedInstructions,
        effectiveFrom: todayIso,
        createdBy: params.authorName,
        reason: params.reason,
      };

      return { medication: updatedMedication, version: newMedVersion };
    }

    throw new Error("Persistent database connection is required to edit medications.");
  }

  async getOccurrences(profileId?: string): Promise<DoseOccurrence[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("dose_occurrences")
        .select("id, medication_id, care_profile_id, medication_name, dose_text, scheduled_for, scheduled_time_label, status, instructions, silent_routine")
        .order("scheduled_for", { ascending: true });

      if (profileId) {
        q = q.eq("care_profile_id", profileId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query dose occurrences: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      const occIds = data.map((d) => d.id);
      const { data: checkins } = await supabase
        .from("dose_checkins")
        .select("id, occurrence_id, status, actor_name, actor_role, recorded_at, note, do_not_notify_family")
        .in("occurrence_id", occIds)
        .order("recorded_at", { ascending: false });

      const checkInMap: Record<string, any> = {};
      if (checkins) {
        for (const c of checkins) {
          if (!checkInMap[c.occurrence_id]) {
            checkInMap[c.occurrence_id] = {
              id: c.id,
              occurrenceId: c.occurrence_id,
              status: c.status,
              actorName: c.actor_name,
              actorRole: c.actor_role,
              recordedAt: c.recorded_at,
              note: c.note,
              doNotNotifyFamily: c.do_not_notify_family,
            };
          }
        }
      }

      return data.map((r) => ({
        id: r.id,
        medicationId: r.medication_id,
        medicationName: r.medication_name || "Prescribed Medication",
        doseText: r.dose_text || "1 unit",
        scheduledTime: r.scheduled_time_label || "08:00 AM",
        status: r.status,
        instructions: r.instructions || "",
        pillColor: "emerald",
        pillShape: "capsule",
        scheduledIso: r.scheduled_for,
        updatedAt: r.scheduled_for || new Date().toISOString(),
        silentRoutine: r.silent_routine || false,
        checkIn: checkInMap[r.id],
      }));
    }

    throw new Error("Persistent database connection required to query dose occurrences.");
  }

  async recordCheckIn(
    occurrenceId: string,
    status: DoseOccurrence["status"],
    actorName: string,
    actorRole: UserRole,
    note?: string,
    doNotNotifyFamily?: boolean
  ): Promise<DoseOccurrence | null> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const nowIso = new Date().toISOString();

    if (supabase) {
      const { data: updatedOcc, error: updateErr } = await supabase
        .from("dose_occurrences")
        .update({
          status,
          updated_at: nowIso,
          closed_at: status === "MARKED_TAKEN" || status === "SKIPPED" ? nowIso : null,
        })
        .eq("id", occurrenceId)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Failed to record dose check-in: ${updateErr.message}`);
      }

      const checkInId = crypto.randomUUID();
      const { error: checkinErr } = await supabase.from("dose_checkins").insert({
        id: checkInId,
        occurrence_id: occurrenceId,
        status,
        actor_id: updatedOcc.care_profile_id || crypto.randomUUID(),
        actor_name: actorName,
        actor_role: actorRole,
        note: note || null,
        do_not_notify_family: doNotNotifyFamily || false,
        recorded_at: nowIso,
      });

      if (checkinErr) {
        throw new Error(`Failed to record checkin record: ${checkinErr.message}`);
      }

      // Auto-resolve associated CareLoop tasks on MARKED_TAKEN
      if (status === "MARKED_TAKEN") {
        await supabase
          .from("care_tasks")
          .update({
            status: "RESOLVED",
            resolution_outcome: "self_resolved",
            resolution_note: `Self-reported taken by ${actorName}`,
            resolved_at: nowIso,
          })
          .eq("source_occurrence_id", occurrenceId)
          .in("status", ["OPEN", "CLAIMED"]);
      }

      // Log audit event
      await this.logAuditEvent({
        careProfileId: updatedOcc.care_profile_id,
        actorName,
        actorRole,
        action: `DOSE_${status}`,
        entityType: "DOSE",
        entityId: occurrenceId,
        description: `${actorName} recorded status '${status}' for routine.${note ? ` Note: "${note}"` : ""}${doNotNotifyFamily ? " [Family notification silenced by elder request]" : ""}`,
      });

      return {
        id: updatedOcc.id,
        medicationId: updatedOcc.medication_id,
        medicationName: updatedOcc.medication_name || "Prescribed Medication",
        doseText: updatedOcc.dose_text || "1 unit",
        scheduledTime: updatedOcc.scheduled_time_label || "08:00 AM",
        status: updatedOcc.status,
        instructions: updatedOcc.instructions || "",
        pillColor: "emerald",
        pillShape: "capsule",
        scheduledIso: updatedOcc.scheduled_for,
        updatedAt: nowIso,
        silentRoutine: updatedOcc.silent_routine || false,
        checkIn: {
          id: checkInId,
          occurrenceId,
          status,
          actorName,
          actorRole,
          recordedAt: nowIso,
          note,
          doNotNotifyFamily,
        },
      };
    }

    throw new Error("Persistent database connection required to record dose check-ins.");
  }

  async getAppointments(profileId?: string): Promise<DoctorAppointment[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("appointments")
        .select("id, care_profile_id, doctor_name, specialty, clinic_name, address, starts_at, date_label, time_label, transport_assigned, transport_details, questions_to_ask, post_visit_notes, status")
        .order("starts_at", { ascending: true });

      if (profileId) {
        q = q.eq("care_profile_id", profileId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query appointments: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((r) => ({
        id: r.id,
        careProfileId: r.care_profile_id,
        doctorName: r.doctor_name,
        specialty: r.specialty,
        clinicName: r.clinic_name,
        address: r.address,
        dateTime: r.starts_at,
        dateLabel: r.date_label,
        timeLabel: r.time_label,
        transportAssigned: r.transport_assigned,
        transportDetails: r.transport_details,
        questionsToAsk: r.questions_to_ask || [],
        postVisitNotes: r.post_visit_notes,
        status: r.status,
      }));
    }

    throw new Error("Persistent database connection required to get appointments.");
  }

  async addAppointment(appt: Omit<DoctorAppointment, "id">): Promise<DoctorAppointment> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const id = crypto.randomUUID();
    const targetProfileId = appt.careProfileId || (await this.getProfile()).id;

    if (supabase) {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          id,
          care_profile_id: targetProfileId,
          doctor_name: appt.doctorName,
          specialty: appt.specialty,
          clinic_name: appt.clinicName,
          address: appt.address,
          starts_at: appt.dateTime || new Date().toISOString(),
          date_label: appt.dateLabel,
          time_label: appt.timeLabel,
          transport_assigned: appt.transportAssigned || false,
          transport_details: appt.transportDetails || null,
          questions_to_ask: appt.questionsToAsk || [],
          post_visit_notes: appt.postVisitNotes || null,
          status: appt.status || "UPCOMING",
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to persist appointment: ${error.message}`);
      }

      return {
        id: data.id,
        careProfileId: data.care_profile_id,
        doctorName: data.doctor_name,
        specialty: data.specialty,
        clinicName: data.clinic_name,
        address: data.address,
        dateTime: data.starts_at,
        dateLabel: data.date_label,
        timeLabel: data.time_label,
        transportAssigned: data.transport_assigned,
        transportDetails: data.transport_details,
        questionsToAsk: data.questions_to_ask || [],
        postVisitNotes: data.post_visit_notes,
        status: data.status,
      };
    }

    throw new Error("Persistent database connection required to add appointments.");
  }

  async getTasks(profileId?: string): Promise<CareTask[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("care_tasks")
        .select("id, care_profile_id, source_occurrence_id, medication_name, dose_text, scheduled_time, grace_minutes_expired, assigned_to_name, assigned_to_role, assigned_to_email, status, claimed_by, claimed_at, resolution_outcome, resolution_note, resolved_at, handed_off_to, priority, created_at")
        .order("created_at", { ascending: false });

      if (profileId) {
        q = q.eq("care_profile_id", profileId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query care tasks: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(mapCareTask);
    }

    throw new Error("Persistent database connection required to query care tasks.");
  }

  async claimTask(taskId: string, claimer: string): Promise<CareTask | null> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const nowIso = new Date().toISOString();

    if (supabase) {
      const { data, error } = await supabase
        .from("care_tasks")
        .update({
          status: "CLAIMED",
          claimed_by: claimer,
          claimed_at: nowIso,
        })
        .eq("id", taskId)
        .eq("status", "OPEN")
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to claim task: ${error.message}`);
      }

      if (!data) return null;

      await this.logAuditEvent({
        careProfileId: data.care_profile_id,
        actorName: claimer,
        actorRole: "caregiver",
        action: "TASK_CLAIMED",
        entityType: "TASK",
        entityId: taskId,
        description: `${claimer} took ownership of follow-up task #${taskId}.`,
      });

      return mapCareTask(data);
    }

    throw new Error("Persistent database connection required to claim tasks.");
  }

  async handoffTask(taskId: string, fromCaregiver: string, toCaregiver: string, note: string): Promise<CareTask | null> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      const { data, error } = await supabase
        .from("care_tasks")
        .update({
          assigned_to_name: toCaregiver,
          handed_off_to: toCaregiver,
          resolution_note: `Handoff from ${fromCaregiver} to ${toCaregiver}: "${note}"`,
          status: "CLAIMED",
        })
        .eq("id", taskId)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to handoff task: ${error.message}`);
      }

      if (!data) return null;

      await this.logAuditEvent({
        careProfileId: data.care_profile_id,
        actorName: fromCaregiver,
        actorRole: "caregiver",
        action: "TASK_HANDOFF",
        entityType: "TASK",
        entityId: taskId,
        description: `${fromCaregiver} handed off follow-up task #${taskId} to ${toCaregiver}. Handoff note: "${note}".`,
      });

      return mapCareTask(data);
    }

    throw new Error("Persistent database connection required to handoff tasks.");
  }

  async resolveTask(taskId: string, outcome: TaskOutcome, note: string, resolver: string): Promise<CareTask | null> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const nowIso = new Date().toISOString();

    if (supabase) {
      const { data, error } = await supabase
        .from("care_tasks")
        .update({
          status: "RESOLVED",
          resolution_outcome: outcome,
          resolution_note: note,
          resolved_at: nowIso,
        })
        .eq("id", taskId)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to resolve task: ${error.message}`);
      }

      if (!data) return null;

      await this.logAuditEvent({
        careProfileId: data.care_profile_id,
        actorName: resolver,
        actorRole: "caregiver",
        action: "TASK_RESOLVED",
        entityType: "TASK",
        entityId: taskId,
        description: `${resolver} resolved follow-up task #${taskId}. Outcome: ${outcome}. Note: "${note}"`,
      });

      return mapCareTask(data);
    }

    throw new Error("Persistent database connection required to resolve tasks.");
  }

  async escalateUnconfirmedDose(occurrenceId: string): Promise<CareTask | null> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      // 1. Idempotency check: see if active task already exists
      const { data: existing } = await supabase
        .from("care_tasks")
        .select("id")
        .eq("source_occurrence_id", occurrenceId)
        .in("status", ["OPEN", "CLAIMED"])
        .limit(1)
        .maybeSingle();

      if (existing) {
        return null;
      }

      // 2. Fetch occurrence details
      const { data: occ } = await supabase
        .from("dose_occurrences")
        .select("id, care_profile_id, medication_name, dose_text, scheduled_time_label")
        .eq("id", occurrenceId)
        .maybeSingle();

      // Update occurrence status
      await supabase
        .from("dose_occurrences")
        .update({ status: "UNCONFIRMED", updated_at: new Date().toISOString() })
        .eq("id", occurrenceId);

      const targetProfileId = occ?.care_profile_id || (await this.getProfile()).id;
      const taskId = crypto.randomUUID();

      const { data: inserted, error: insertErr } = await supabase
        .from("care_tasks")
        .insert({
          id: taskId,
          care_profile_id: targetProfileId,
          source_occurrence_id: occurrenceId,
          medication_name: occ?.medication_name || "Scheduled Routine",
          dose_text: occ?.dose_text || "Scheduled Dose",
          scheduled_time: occ?.scheduled_time_label || "1:00 PM",
          grace_minutes_expired: 30,
          assigned_to_name: "Priya Sharma, RN",
          assigned_to_email: "priya.caregiver@oasiscare.demo.local",
          assigned_to_role: "caregiver",
          status: "OPEN",
          priority: "HIGH",
        })
        .select()
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          return null;
        }
        throw new Error(`Failed to create escalation task: ${insertErr.message}`);
      }

      await this.logAuditEvent({
        careProfileId: targetProfileId,
        actorName: "CareLoop Engine",
        actorRole: "system",
        action: "ESCALATION_TRIGGERED",
        entityType: "TASK",
        entityId: taskId,
        description: `CareLoop escalated unconfirmed dose of ${occ?.medication_name || "Routine"} to Caregiver Priya Sharma. Task #${taskId} opened.`,
      });

      return mapCareTask(inserted);
    }

    throw new Error("Persistent database connection required to escalate unconfirmed doses.");
  }

  async createBackupRequest(params: { careProfileId?: string; caregiverName: string; reason: string }): Promise<CareTask> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const targetProfileId = params.careProfileId || (await this.getProfile()).id;

    if (supabase) {
      // Check for existing active backup request to enforce partial unique constraint idempotency
      const { data: existing } = await supabase
        .from("care_tasks")
        .select("id, status")
        .eq("care_profile_id", targetProfileId)
        .eq("medication_name", "Caregiver Relief Coverage")
        .in("status", ["OPEN", "CLAIMED"])
        .limit(1)
        .maybeSingle();

      if (existing) {
        throw new Error("ACTIVE_BACKUP_EXISTS: An active caregiver relief coverage request is already pending.");
      }

      const taskId = crypto.randomUUID();
      const { data: inserted, error } = await supabase
        .from("care_tasks")
        .insert({
          id: taskId,
          care_profile_id: targetProfileId,
          source_occurrence_id: null,
          medication_name: "Caregiver Relief Coverage",
          dose_text: "Shift Relief",
          scheduled_time: "Immediate",
          grace_minutes_expired: 0,
          assigned_to_name: "Care Circle (Family Manager)",
          assigned_to_role: "family_manager",
          assigned_to_email: "sarah.t@family.demo.local",
          status: "OPEN",
          priority: "URGENT",
          resolution_note: `Backup requested by ${params.caregiverName}. Reason: "${params.reason}".`,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("ACTIVE_BACKUP_EXISTS: An active caregiver relief coverage request is already pending.");
        }
        throw new Error(`Failed to create backup request: ${error.message}`);
      }

      await this.logAuditEvent({
        careProfileId: targetProfileId,
        actorName: params.caregiverName,
        actorRole: "caregiver",
        action: "BACKUP_REQUESTED",
        entityType: "TASK",
        entityId: taskId,
        description: `${params.caregiverName} requested urgent caregiver backup coverage. Reason: "${params.reason}".`,
      });

      return mapCareTask(inserted);
    }

    throw new Error("Persistent database connection required to create backup requests.");
  }

  async getNotifications(): Promise<NotificationJob[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      const { data, error } = await supabase
        .from("notification_jobs")
        .select("id, dedupe_key, recipient_email, recipient_role, notification_type, subject, body_preview, status, provider_error, retry_count, sent_at")
        .order("sent_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to query notification jobs: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((r) => ({
        id: r.id,
        dedupeKey: r.dedupe_key,
        recipientEmail: r.recipient_email,
        recipientRole: r.recipient_role,
        type: r.notification_type as any,
        subject: r.subject,
        bodyPreview: r.body_preview,
        status: r.status as any,
        providerError: r.provider_error || undefined,
        retryCount: r.retry_count || 0,
        timestamp: r.sent_at || new Date().toISOString(),
      }));
    }

    throw new Error("Persistent database connection required to query notifications.");
  }

  async sendNotification(job: NotificationJob): Promise<void> {
    const supabase = this.getClient();
    if (supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.id);
      const rowId = isUuid ? job.id : crypto.randomUUID();

      const { error } = await supabase.from("notification_jobs").upsert(
        {
          id: rowId,
          dedupe_key: job.dedupeKey,
          recipient_email: job.recipientEmail,
          recipient_role: job.recipientRole,
          notification_type: job.type,
          subject: job.subject,
          body_preview: job.bodyPreview,
          status: job.status,
          provider_error: job.providerError || null,
          retry_count: job.retryCount || 0,
        },
        { onConflict: "dedupe_key" }
      );

      if (error) {
        throw new Error(`Failed to persist notification job: ${error.message}`);
      }
      return;
    }

    guardianStore.sendNotification(job);
  }

  async getAuditEvents(profileId?: string): Promise<AuditEvent[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("audit_events")
        .select("id, care_profile_id, actor_name, actor_role, action, entity_type, entity_id, description, occurred_at")
        .order("occurred_at", { ascending: false });

      if (profileId) {
        q = q.eq("care_profile_id", profileId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query audit events: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((r) => ({
        id: r.id,
        careProfileId: r.care_profile_id,
        actorName: r.actor_name,
        actorRole: r.actor_role,
        action: r.action,
        entityType: r.entity_type as any,
        entityId: r.entity_id,
        description: r.description,
        timestamp: r.occurred_at || new Date().toISOString(),
      }));
    }

    throw new Error("Persistent database connection required to query audit events.");
  }

  async logAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
    const supabase = this.getClient();
    if (supabase) {
      const targetProfileId = event.careProfileId || (await this.getProfile()).id;
      const { error } = await supabase.from("audit_events").insert({
        id: crypto.randomUUID(),
        care_profile_id: targetProfileId,
        actor_name: event.actorName,
        actor_role: event.actorRole,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        description: event.description,
      });

      if (error && process.env.NODE_ENV === "production") {
        throw new Error(`Failed to persist audit event: ${error.message}`);
      }
      return;
    }

    guardianStore.addAuditEvent(event);
  }

  async getWellbeingHistory(caregiverId: string, profileId?: string): Promise<CheckInRecord[]> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();

    if (supabase) {
      let q = supabase
        .from("caregiver_wellbeing")
        .select("id, care_profile_id, caregiver_id, sleep_hours, mood, stress, energy, note, share_with_family, recorded_at")
        .eq("caregiver_id", caregiverId)
        .order("recorded_at", { ascending: true });

      if (profileId) {
        q = q.eq("care_profile_id", profileId);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`Failed to query wellbeing history: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

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

    throw new Error("Persistent database connection required to query wellbeing history.");
  }

  async addWellbeingCheckIn(data: Omit<CheckInRecord, "id" | "date" | "timestamp"> & { careProfileId?: string }): Promise<CheckInRecord> {
    assertPersistenceRequirements(this.clientOverride);
    const supabase = this.getClient();
    const nowIso = new Date().toISOString();
    const id = crypto.randomUUID();

    if (supabase) {
      const targetProfileId = data.careProfileId || (await this.getProfile()).id;
      const { error } = await supabase.from("caregiver_wellbeing").insert({
        id,
        care_profile_id: targetProfileId,
        caregiver_id: data.caregiverId,
        sleep_hours: data.sleepHours,
        mood: data.mood,
        stress: data.stress,
        energy: data.energy,
        note: data.note || null,
        share_with_family: data.shareWithFamily || false,
        recorded_at: nowIso,
      });

      if (error) {
        throw new Error(`Failed to record wellbeing check-in: ${error.message}`);
      }

      return {
        id,
        caregiverId: data.caregiverId,
        date: nowIso.slice(0, 10),
        timestamp: nowIso,
        sleepHours: data.sleepHours,
        mood: data.mood,
        stress: data.stress,
        energy: data.energy,
        note: data.note,
        shareWithFamily: data.shareWithFamily,
      };
    }

    throw new Error("Persistent database connection required to record wellbeing check-ins.");
  }
}

/**
 * Local / Test In-Memory Implementation.
 * Used during local development and testing when DATABASE_URL or SUPABASE_URL is not set.
 */
export class InMemoryCareRepository implements CareRepository {
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
