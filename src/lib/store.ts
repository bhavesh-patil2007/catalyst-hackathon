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
  DailyCareBrief,
  DoseStatus,
  UserRole,
  RefillRunway,
} from "@/types";

export const INITIAL_PROFILE: CareProfile = {
  id: "profile-eleanor-thompson",
  displayName: "Eleanor Thompson",
  age: 76,
  initials: "ET",
  conditions: [
    "Type 2 Diabetes",
    "High Blood Pressure",
    "Arthritis",
    "Limited Mobility · Uses Walker",
    "Mild Memory Issues",
  ],
  notes: [
    "Prefers morning medicines taken with oatmeal or light breakfast",
    "Emergency keybox passcode is with daughter Sarah",
    "Dr. Robert Vance is cardiologist at St. Jude Clinic",
  ],
  passcode: "1234",
  circleInviteCode: "OASIS-7629",
  timezone: "America/New_York",
  locale: "en",
};

export const INITIAL_MEMBERS: CareMember[] = [
  {
    id: "mem-eleanor",
    careProfileId: "profile-eleanor-thompson",
    name: "Eleanor Thompson",
    email: "eleanor.thompson.care@demo.local",
    role: "owner",
    relationship: "Self (Older Adult)",
    phone: "+1 (555) 234-5678",
  },
  {
    id: "mem-sarah",
    careProfileId: "profile-eleanor-thompson",
    name: "Sarah Thompson",
    email: "sarah.t@family.demo.local",
    role: "family_manager",
    relationship: "Daughter (Primary Family Contact)",
    phone: "+1 (555) 345-6789",
  },
  {
    id: "mem-priya",
    careProfileId: "profile-eleanor-thompson",
    name: "Priya Sharma, RN",
    email: "priya.caregiver@oasiscare.demo.local",
    role: "caregiver",
    relationship: "Visiting Nurse & Caregiver",
    phone: "+1 (555) 456-7890",
    isPrimaryCaregiver: true,
  },
  {
    id: "mem-david",
    careProfileId: "profile-eleanor-thompson",
    name: "David Thompson",
    email: "david.t@family.demo.local",
    role: "read_only",
    relationship: "Son (Out of State)",
    phone: "+1 (555) 567-8901",
  },
];

export const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: "med-metformin",
    careProfileId: "profile-eleanor-thompson",
    name: "Metformin ER",
    dosage: "500 mg",
    instructions: "Take with morning breakfast and a glass of water.",
    pillColor: "emerald",
    pillShape: "capsule",
    active: true,
    currentVersion: 1,
    remainingQuantity: 24,
    dailyFrequency: 1,
    refillThreshold: 7,
    scheduleTime: "08:00 AM",
    slot: "morning",
    silentRoutine: false,
  },
  {
    id: "med-lisinopril",
    careProfileId: "profile-eleanor-thompson",
    name: "Lisinopril",
    dosage: "10 mg",
    instructions: "Blood pressure tablet. Do not take with salt substitutes.",
    pillColor: "sky",
    pillShape: "round",
    active: true,
    currentVersion: 1,
    remainingQuantity: 5, // Low stock to demonstrate Refill Runway!
    dailyFrequency: 1,
    refillThreshold: 7,
    scheduleTime: "08:00 AM",
    slot: "morning",
    silentRoutine: false,
  },
  {
    id: "med-atorvastatin",
    careProfileId: "profile-eleanor-thompson",
    name: "Atorvastatin",
    dosage: "20 mg",
    instructions: "Cholesterol tablet. Take in the evening before bed.",
    pillColor: "amber",
    pillShape: "oval",
    active: true,
    currentVersion: 1,
    remainingQuantity: 30,
    dailyFrequency: 1,
    refillThreshold: 7,
    scheduleTime: "08:30 PM",
    slot: "bedtime",
    silentRoutine: false,
  },
];

export const INITIAL_VERSIONS: MedicationVersion[] = [
  {
    id: "ver-met-1",
    medicationId: "med-metformin",
    version: 1,
    labelName: "Metformin ER 500 mg",
    doseText: "1 capsule (500mg)",
    instructions: "Take with morning breakfast and a glass of water.",
    effectiveFrom: "2026-10-01",
    createdBy: "Dr. A. Sharma / Confirmed by Sarah Thompson",
    reason: "Initial discharge prescription from clinic",
    confirmedBy: "Sarah Thompson",
  },
  {
    id: "ver-lis-1",
    medicationId: "med-lisinopril",
    version: 1,
    labelName: "Lisinopril 10 mg",
    doseText: "1 round tablet (10mg)",
    instructions: "Blood pressure tablet. Do not take with salt substitutes.",
    effectiveFrom: "2026-09-15",
    createdBy: "Dr. Robert Vance / Confirmed by Sarah Thompson",
    reason: "Hypertension baseline maintenance",
    confirmedBy: "Sarah Thompson",
  },
  {
    id: "ver-ato-1",
    medicationId: "med-atorvastatin",
    version: 1,
    labelName: "Atorvastatin 20 mg",
    doseText: "1 oval tablet (20mg)",
    instructions: "Cholesterol tablet. Take in the evening before bed.",
    effectiveFrom: "2026-09-15",
    createdBy: "Dr. Robert Vance",
    reason: "Lipid panel management",
    confirmedBy: "Sarah Thompson",
  },
];

export const INITIAL_OCCURRENCES: DoseOccurrence[] = [
  {
    id: "occ-today-morning-met",
    medicationId: "med-metformin",
    medicationName: "Metformin ER",
    doseText: "500 mg (1 Capsule)",
    instructions: "Take with morning breakfast and water.",
    pillColor: "emerald",
    pillShape: "capsule",
    scheduledTime: "08:00 AM",
    scheduledIso: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
    status: "MARKED_TAKEN",
    updatedAt: "8:06 AM",
    checkIn: {
      id: "chk-1",
      occurrenceId: "occ-today-morning-met",
      status: "MARKED_TAKEN",
      actorName: "Eleanor Thompson",
      actorRole: "owner",
      recordedAt: "8:06 AM",
      note: "Taken with oatmeal and tea",
    },
  },
  {
    id: "occ-today-morning-lis",
    medicationId: "med-lisinopril",
    medicationName: "Lisinopril",
    doseText: "10 mg (1 Round Tablet)",
    instructions: "Blood pressure maintenance.",
    pillColor: "sky",
    pillShape: "round",
    scheduledTime: "08:00 AM",
    scheduledIso: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
    status: "MARKED_TAKEN",
    updatedAt: "8:07 AM",
    checkIn: {
      id: "chk-2",
      occurrenceId: "occ-today-morning-lis",
      status: "MARKED_TAKEN",
      actorName: "Eleanor Thompson",
      actorRole: "owner",
      recordedAt: "8:07 AM",
    },
  },
  {
    id: "occ-today-afternoon-joint",
    medicationId: "med-glucosamine",
    medicationName: "Joint Comfort Supplement",
    doseText: "1 Tablet",
    instructions: "Take with afternoon snack.",
    pillColor: "rose",
    pillShape: "oval",
    scheduledTime: "01:00 PM",
    scheduledIso: new Date(new Date().setHours(13, 0, 0, 0)).toISOString(),
    status: "PENDING",
    updatedAt: "1:00 PM",
  },
  {
    id: "occ-today-evening-ato",
    medicationId: "med-atorvastatin",
    medicationName: "Atorvastatin",
    doseText: "20 mg (1 Oval Tablet)",
    instructions: "Cholesterol tablet before bed.",
    pillColor: "amber",
    pillShape: "oval",
    scheduledTime: "08:30 PM",
    scheduledIso: new Date(new Date().setHours(20, 30, 0, 0)).toISOString(),
    status: "SCHEDULED",
    updatedAt: "Pending scheduled time",
  },
];

export const INITIAL_APPOINTMENTS: DoctorAppointment[] = [
  {
    id: "appt-vance-cardio",
    careProfileId: "profile-eleanor-thompson",
    doctorName: "Dr. Robert Vance, MD",
    specialty: "Cardiology & Vascular Health",
    clinicName: "St. Jude Heart & Wellness Pavilion",
    address: "420 Maple Avenue, Suite 300",
    dateTime: "Tomorrow, 10:30 AM",
    dateLabel: "Tomorrow, Nov 16",
    timeLabel: "10:30 AM",
    transportAssigned: true,
    transportDetails: "Daughter Sarah driving (leaves at 9:50 AM)",
    questionsToAsk: [
      "Review Lisinopril dosage based on recent morning BP readings",
      "Ask if occasional ankle swelling is related to medication",
      "Refill prescription for next 90 days",
    ],
    postVisitNotes: "Previous visit (3 months ago): BP was 128/82. Target is <130/80.",
    status: "UPCOMING",
  },
  {
    id: "appt-patel-endo",
    careProfileId: "profile-eleanor-thompson",
    doctorName: "Dr. Anita Patel, MD",
    specialty: "Endocrinology (Diabetes Management)",
    clinicName: "Metro Health Specialty Center",
    address: "710 Elm Boulevard, Floor 2",
    dateTime: "Next Tuesday, 2:15 PM",
    dateLabel: "Nov 24",
    timeLabel: "2:15 PM",
    transportAssigned: false,
    questionsToAsk: ["Review HbA1c lab report (current: 6.8%)"],
    status: "UPCOMING",
  },
];

export const INITIAL_TASKS: CareTask[] = [
  {
    id: "task-careloop-101",
    careProfileId: "profile-eleanor-thompson",
    sourceOccurrenceId: "occ-sample-unconfirmed",
    medicationName: "Afternoon Calcium + D3",
    doseText: "600 mg",
    scheduledTime: "12:30 PM",
    graceMinutesExpired: 35,
    assignedToName: "Priya Sharma, RN",
    assignedToRole: "Caregiver",
    assignedToEmail: "priya.caregiver@oasiscare.demo.local",
    status: "OPEN",
    priority: "HIGH",
    createdAt: "1:05 PM",
  },
];

export const INITIAL_NOTIFICATIONS: NotificationJob[] = [
  {
    id: "notif-001",
    dedupeKey: "dose-due-metformin-2026-11-15",
    recipientEmail: "eleanor.thompson.care@demo.local",
    recipientRole: "Older Adult",
    type: "DOSE_DUE",
    subject: "Guardian Oasis: Morning Routine Reminder (8:00 AM)",
    bodyPreview: "Good morning Eleanor. Your morning routine is scheduled for 8:00 AM.",
    status: "DELIVERED",
    timestamp: "8:00 AM",
  },
  {
    id: "notif-002",
    dedupeKey: "escalation-calcium-2026-11-15-priya",
    recipientEmail: "priya.caregiver@oasiscare.demo.local",
    recipientRole: "Caregiver",
    type: "MISSED_DOSE_ESCALATION",
    subject: "CareLoop Alert: Unconfirmed Afternoon Routine for Eleanor Thompson",
    bodyPreview: "Afternoon Calcium dose remained unconfirmed past the 30-min grace window. CareLoop created task #C-101.",
    status: "DELIVERED",
    timestamp: "1:05 PM",
  },
];

export const INITIAL_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "aud-001",
    careProfileId: "profile-eleanor-thompson",
    actorName: "Eleanor Thompson",
    actorRole: "owner",
    action: "CHECK_IN_TAKEN",
    entityType: "DOSE",
    entityId: "occ-today-morning-met",
    description: "Marked Metformin ER (500mg) as taken at 8:06 AM with breakfast.",
    timestamp: "Today at 8:06 AM",
  },
  {
    id: "aud-002",
    careProfileId: "profile-eleanor-thompson",
    actorName: "Eleanor Thompson",
    actorRole: "owner",
    action: "CHECK_IN_TAKEN",
    entityType: "DOSE",
    entityId: "occ-today-morning-lis",
    description: "Marked Lisinopril (10mg) as taken at 8:07 AM.",
    timestamp: "Today at 8:07 AM",
  },
  {
    id: "aud-003",
    careProfileId: "profile-eleanor-thompson",
    actorName: "System (CareLoop Engine)",
    actorRole: "system",
    action: "ESCALATION_TRIGGERED",
    entityType: "TASK",
    entityId: "task-careloop-101",
    description: "Grace window (30m) expired for Afternoon routine. CareTask #C-101 created and routed to Priya Sharma, RN.",
    timestamp: "Today at 1:05 PM",
  },
];

class GuardianStore {
  profile: CareProfile = { ...INITIAL_PROFILE };
  members: CareMember[] = [...INITIAL_MEMBERS];
  medications: Medication[] = [...INITIAL_MEDICATIONS];
  versions: MedicationVersion[] = [...INITIAL_VERSIONS];
  occurrences: DoseOccurrence[] = [...INITIAL_OCCURRENCES];
  appointments: DoctorAppointment[] = [...INITIAL_APPOINTMENTS];
  tasks: CareTask[] = [...INITIAL_TASKS];
  notifications: NotificationJob[] = [...INITIAL_NOTIFICATIONS];
  auditEvents: AuditEvent[] = [...INITIAL_AUDIT_EVENTS];

  getProfile() {
    return this.profile;
  }

  /**
   * Sanitized profile for public/client delivery.
   * Strips raw senior 4-digit PIN to prevent credential exposure in API responses.
   */
  getSanitizedProfile(role?: UserRole) {
    const isPrivileged = role === "owner" || role === "family_manager";
    return {
      id: this.profile.id,
      displayName: this.profile.displayName,
      age: this.profile.age,
      initials: this.profile.initials,
      avatarUrl: this.profile.avatarUrl,
      conditions: this.profile.conditions,
      notes: this.profile.notes,
      passcode: "••••", // Redacted for security
      passcodeMasked: "•••• (4-digit PIN active)",
      circleInviteCode: isPrivileged ? this.profile.circleInviteCode : "••••••••",
      timezone: this.profile.timezone,
      locale: this.profile.locale,
    };
  }

  /**
   * Patient-level boundary verification.
   * Ensures caregivers or circle members cannot access unrelated patient profiles.
   */
  verifyPatientAccess(actorProfileId?: string, targetProfileId?: string): boolean {
    if (!targetProfileId) return true;
    const currentId = actorProfileId || this.profile.id;
    return currentId === targetProfileId;
  }

  setLocale(locale: "en" | "hi") {
    this.profile.locale = locale;
  }

  getMembers() {
    return this.members;
  }

  getMedications() {
    return this.medications;
  }

  getOccurrences() {
    return this.occurrences;
  }

  getAppointments() {
    return this.appointments;
  }

  getTasks() {
    return this.tasks;
  }

  getNotifications() {
    return this.notifications;
  }

  getAuditEvents() {
    return this.auditEvents;
  }

  // Feature 7: Refill Runway Estimation
  getRefillRunways(): RefillRunway[] {
    return this.medications.map((med) => {
      const daily = med.dailyFrequency || 1;
      const days = Math.floor(med.remainingQuantity / daily);
      const runOutDate = new Date();
      runOutDate.setDate(runOutDate.getDate() + days);

      return {
        medicationId: med.id,
        medicationName: med.name,
        remainingQuantity: med.remainingQuantity,
        dailyConsumption: daily,
        daysRemaining: days,
        estimatedRunOutDate: runOutDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        isLowStock: days <= med.refillThreshold,
      };
    });
  }

  // Record check-in from Elder or Caregiver (Supports NOT_SURE & silent routine)
  recordCheckIn(
    occurrenceId: string,
    status: DoseStatus,
    actorName: string,
    actorRole: UserRole,
    note?: string,
    doNotNotifyFamily?: boolean
  ): DoseOccurrence | null {
    const occ = this.occurrences.find((o) => o.id === occurrenceId);
    if (!occ) return null;

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    occ.status = status;
    occ.updatedAt = timeString;
    if (doNotNotifyFamily !== undefined) {
      occ.silentRoutine = doNotNotifyFamily;
    }

    occ.checkIn = {
      id: "chk-" + Date.now(),
      occurrenceId,
      status,
      actorName,
      actorRole,
      recordedAt: timeString,
      note,
    };

    // If an associated CareLoop task exists, update its status
    const task = this.tasks.find((t) => t.sourceOccurrenceId === occurrenceId);
    if (task && status === "MARKED_TAKEN") {
      task.status = "RESOLVED";
      task.resolutionOutcome = "self_resolved";
      task.resolutionNote = `Self-reported taken by ${actorName}`;
      task.resolvedAt = timeString;
    } else if (task && status === "NOT_SURE") {
      task.priority = "URGENT";
      task.resolutionNote = `Elder marked 'Not sure' - needs verification.`;
    }

    // Append to audit trail
    this.auditEvents.unshift({
      id: "aud-" + Date.now(),
      careProfileId: this.profile.id,
      actorName,
      actorRole,
      action: `DOSE_${status}`,
      entityType: "DOSE",
      entityId: occ.id,
      description: `${actorName} recorded status '${status}' for ${occ.medicationName} (${occ.doseText}).${note ? ` Note: "${note}"` : ""}${doNotNotifyFamily ? " [Family notification silenced by elder request]" : ""}`,
      timestamp: `Today at ${timeString}`,
    });

    return occ;
  }

  // CareLoop instant escalation trigger
  escalateUnconfirmedDose(occurrenceId: string): CareTask {
    const occ = this.occurrences.find((o) => o.id === occurrenceId);
    const medName = occ ? occ.medicationName : "Afternoon Routine";
    const doseText = occ ? occ.doseText : "Scheduled Dose";
    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (occ) {
      occ.status = "UNCONFIRMED";
      occ.updatedAt = timeString;
    }

    const newTask: CareTask = {
      id: "task-careloop-" + Math.floor(100 + Math.random() * 900),
      careProfileId: this.profile.id,
      sourceOccurrenceId: occurrenceId,
      medicationName: medName,
      doseText,
      scheduledTime: occ ? occ.scheduledTime : "1:00 PM",
      graceMinutesExpired: 30,
      assignedToName: "Priya Sharma, RN",
      assignedToRole: "Caregiver",
      assignedToEmail: "priya.caregiver@oasiscare.demo.local",
      status: "OPEN",
      priority: "HIGH",
      createdAt: timeString,
    };

    this.tasks.unshift(newTask);

    this.sendNotification({
      id: "notif-" + Date.now(),
      dedupeKey: `escalation-${occurrenceId}-${Date.now()}`,
      recipientEmail: "priya.caregiver@oasiscare.demo.local",
      recipientRole: "Caregiver",
      type: "MISSED_DOSE_ESCALATION",
      subject: `CareLoop Escalation: Unconfirmed Routine for ${this.profile.displayName}`,
      bodyPreview: `No response was recorded for ${medName} within the 30-minute grace period. Please follow up.`,
      status: "DELIVERED",
      timestamp: timeString,
    });

    this.auditEvents.unshift({
      id: "aud-" + Date.now(),
      careProfileId: this.profile.id,
      actorName: "CareLoop Engine",
      actorRole: "system",
      action: "ESCALATION_TRIGGERED",
      entityType: "TASK",
      entityId: newTask.id,
      description: `CareLoop escalated unconfirmed dose of ${medName} to Caregiver Priya Sharma. Task #${newTask.id} opened.`,
      timestamp: `Today at ${timeString}`,
    });

    return newTask;
  }

  // Claim follow-up task
  claimTask(taskId: string, caregiverName: string): CareTask | null {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    task.status = "CLAIMED";
    task.claimedBy = caregiverName;
    task.claimedAt = timeString;

    this.auditEvents.unshift({
      id: "aud-" + Date.now(),
      careProfileId: this.profile.id,
      actorName: caregiverName,
      actorRole: "caregiver",
      action: "TASK_CLAIMED",
      entityType: "TASK",
      entityId: task.id,
      description: `${caregiverName} took ownership of follow-up task #${task.id}.`,
      timestamp: `Today at ${timeString}`,
    });

    return task;
  }

  // Feature 4: Caregiver Relay and Handoff
  handoffTask(
    taskId: string,
    fromCaregiver: string,
    toCaregiver: string,
    handoffNote: string
  ): CareTask | null {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    task.status = "CLAIMED";
    task.claimedBy = toCaregiver;
    task.assignedToName = toCaregiver;
    task.resolutionOutcome = "handed_off";
    task.handedOffTo = toCaregiver;
    task.resolutionNote = `Handoff from ${fromCaregiver} to ${toCaregiver}: "${handoffNote}"`;

    this.auditEvents.unshift({
      id: "aud-" + Date.now(),
      careProfileId: this.profile.id,
      actorName: fromCaregiver,
      actorRole: "caregiver",
      action: "TASK_HANDOFF",
      entityType: "TASK",
      entityId: task.id,
      description: `${fromCaregiver} handed off follow-up task #${task.id} to ${toCaregiver}. Handoff note: "${handoffNote}".`,
      timestamp: `Today at ${timeString}`,
    });

    return task;
  }

  // Resolve follow-up task
  resolveTask(
    taskId: string,
    outcome: CareTask["resolutionOutcome"],
    note: string,
    actorName: string
  ): CareTask | null {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    task.status = "RESOLVED";
    task.resolutionOutcome = outcome;
    task.resolutionNote = note;
    task.resolvedAt = timeString;

    this.auditEvents.unshift({
      id: "aud-" + Date.now(),
      careProfileId: this.profile.id,
      actorName,
      actorRole: "caregiver",
      action: "TASK_RESOLVED",
      entityType: "TASK",
      entityId: task.id,
      description: `${actorName} resolved follow-up task #${task.id}. Outcome: ${outcome}. Note: "${note}"`,
      timestamp: `Today at ${timeString}`,
    });

    return task;
  }

  addMedicationWithVersion(data: {
    name: string;
    dosage: string;
    instructions: string;
    scheduleTime: string;
    slot: "morning" | "afternoon" | "evening" | "bedtime";
    pillColor: string;
    pillShape: "round" | "capsule" | "oval" | "liquid";
    reason: string;
    authorName: string;
    silentRoutine?: boolean;
  }): Medication {
    const medId = "med-" + Date.now();
    const verId = "ver-" + Date.now();

    const newMed: Medication = {
      id: medId,
      careProfileId: this.profile.id,
      name: data.name,
      dosage: data.dosage,
      instructions: data.instructions,
      pillColor: data.pillColor,
      pillShape: data.pillShape,
      active: true,
      currentVersion: 1,
      remainingQuantity: 30,
      dailyFrequency: 1,
      refillThreshold: 7,
      scheduleTime: data.scheduleTime,
      slot: data.slot,
      silentRoutine: data.silentRoutine || false,
    };

    const newVersion: MedicationVersion = {
      id: verId,
      medicationId: medId,
      version: 1,
      labelName: `${data.name} ${data.dosage}`,
      doseText: `${data.dosage}`,
      instructions: data.instructions,
      effectiveFrom: new Date().toISOString().split("T")[0],
      createdBy: data.authorName,
      reason: data.reason,
      confirmedBy: data.authorName,
    };

    this.medications.push(newMed);
    this.versions.push(newVersion);

    this.occurrences.push({
      id: "occ-" + Date.now(),
      medicationId: medId,
      medicationName: data.name,
      doseText: data.dosage,
      instructions: data.instructions,
      pillColor: data.pillColor,
      pillShape: data.pillShape,
      scheduledTime: data.scheduleTime,
      scheduledIso: new Date().toISOString(),
      status: "SCHEDULED",
      updatedAt: "Scheduled",
      silentRoutine: data.silentRoutine || false,
    });

    this.auditEvents.unshift({
      id: "aud-" + Date.now(),
      careProfileId: this.profile.id,
      actorName: data.authorName,
      actorRole: "family_manager",
      action: "MEDICATION_CREATED",
      entityType: "MEDICATION",
      entityId: medId,
      description: `${data.authorName} created medication ${data.name} (${data.dosage}) with schedule ${data.scheduleTime}. Reason: "${data.reason}".`,
      timestamp: `Today at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    });

    return newMed;
  }

  addAppointment(appt: Omit<DoctorAppointment, "id" | "careProfileId">): DoctorAppointment {
    const newAppt: DoctorAppointment = {
      ...appt,
      id: "appt-" + Date.now(),
      careProfileId: this.profile.id,
    };
    this.appointments.unshift(newAppt);

    this.auditEvents.unshift({
      id: "aud-" + Date.now(),
      careProfileId: this.profile.id,
      actorName: "Sarah Thompson",
      actorRole: "family_manager",
      action: "APPOINTMENT_SCHEDULED",
      entityType: "APPOINTMENT",
      entityId: newAppt.id,
      description: `Scheduled doctor visit with ${newAppt.doctorName} for ${newAppt.dateLabel} at ${newAppt.timeLabel}.`,
      timestamp: `Today at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    });

    return newAppt;
  }

  sendNotification(job: NotificationJob): boolean {
    const exists = this.notifications.some((n) => n.dedupeKey === job.dedupeKey);
    if (exists) {
      return false;
    }
    this.notifications.unshift(job);
    return true;
  }

  getDailyCareBrief(): DailyCareBrief {
    const totalScheduled = this.occurrences.length;
    const takenCount = this.occurrences.filter((o) => o.status === "MARKED_TAKEN").length;
    const unconfirmedCount = this.occurrences.filter(
      (o) => o.status === "UNCONFIRMED" || o.status === "PENDING"
    ).length;
    const openTasks = this.tasks.filter((t) => t.status === "OPEN" || t.status === "CLAIMED");

    const takenItems = this.occurrences
      .filter((o) => o.status === "MARKED_TAKEN")
      .map((o) => `${o.scheduledTime} - ${o.medicationName}: marked taken by ${o.checkIn?.actorName || "Eleanor"} at ${o.checkIn?.recordedAt || o.updatedAt}`)
      .join(". ");

    const pendingItems = this.occurrences
      .filter((o) => o.status === "PENDING" || o.status === "UNCONFIRMED")
      .map((o) => `${o.scheduledTime} - ${o.medicationName}: ${o.status.toLowerCase()}`)
      .join(", ");

    const nextAppt = this.appointments[0];

    const summaryText = `Daily Care Brief for Eleanor Thompson (Today):
• Routines: ${takenCount} of ${totalScheduled} marked taken.${takenItems ? ` (${takenItems})` : ""}
• Unconfirmed/Pending: ${unconfirmedCount > 0 ? pendingItems : "None"}.
• Next Appointment: ${nextAppt ? `${nextAppt.doctorName} on ${nextAppt.dateLabel} at ${nextAppt.timeLabel} (${nextAppt.clinicName}). Transport: ${nextAppt.transportAssigned ? "Arranged" : "Pending"}.` : "None scheduled"}.
• CareLoop Tasks: ${openTasks.length} open follow-up${openTasks.length === 1 ? "" : "s"}.
Source: Verified application records only.`;

    return {
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      summaryText,
      takenCount,
      totalScheduled,
      unconfirmedCount,
      upcomingAppointments: nextAppt ? [`${nextAppt.doctorName} - ${nextAppt.dateTime}`] : [],
      openTasksCount: openTasks.length,
      generatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isAiGrounded: true,
      sourceRecords: [
        `Occurrences: ${this.occurrences.length}`,
        `Appointments: ${this.appointments.length}`,
        `CareTasks: ${this.tasks.length}`,
      ],
    };
  }
}

export const guardianStore = new GuardianStore();
