"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ElderHeader } from "@/components/ElderHeader";
import { DoseCard } from "@/components/DoseCard";
import { CareLoopTaskCard } from "@/components/CareLoopTaskCard";
import { EmailNotificationDrawer } from "@/components/EmailNotificationDrawer";
import { DailyCareBriefModal } from "@/components/DailyCareBriefModal";
import { AddAppointmentModal } from "@/components/AddAppointmentModal";
import { WhoCanSeeModal } from "@/components/WhoCanSeeModal";
import { RefillRunwayWidget } from "@/components/RefillRunwayWidget";
import {
  Calendar,
  AlertTriangle,
  Sparkles,
  Heart,
  Activity,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Car,
  Phone,
  FileText,
  Zap,
} from "lucide-react";
import {
  CareProfile,
  CareMember,
  Medication,
  DoseOccurrence,
  DoctorAppointment,
  CareTask,
  NotificationJob,
  DailyCareBrief,
  RefillRunway,
  DoseStatus,
  UserRole,
} from "@/types";

export default function DashboardPage() {
  const [activeRole, setActiveRole] = useState<UserRole>("family_manager");
  const [selectedDate, setSelectedDate] = useState("Today");
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [members, setMembers] = useState<CareMember[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [occurrences, setOccurrences] = useState<DoseOccurrence[]>([]);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [notifications, setNotifications] = useState<NotificationJob[]>([]);
  const [brief, setBrief] = useState<DailyCareBrief | null>(null);
  const [refillRunways, setRefillRunways] = useState<RefillRunway[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
  const [isAddApptModalOpen, setIsAddApptModalOpen] = useState(false);
  const [isWhoCanSeeModalOpen, setIsWhoCanSeeModalOpen] = useState(false);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/care/today");
      const json = await res.json();
      if (json.success) {
        setProfile(json.data.profile);
        setMembers(json.data.members);
        setMedications(json.data.medications);
        setOccurrences(json.data.occurrences);
        setAppointments(json.data.appointments);
        setTasks(json.data.tasks);
        setNotifications(json.data.notifications);
        setBrief(json.data.brief);
        setRefillRunways(json.data.refillRunways || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckIn = async (
    occurrenceId: string,
    status: DoseStatus,
    note?: string,
    doNotNotifyFamily?: boolean
  ) => {
    try {
      const actorName =
        activeRole === "owner"
          ? profile?.displayName || "Eleanor Thompson"
          : activeRole === "caregiver"
          ? "Priya Sharma, RN"
          : "Sarah Thompson";

      const res = await fetch("/api/doses/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceId,
          status,
          actorName,
          actorRole: activeRole,
          note,
          doNotNotifyFamily,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertBanner(`Check-in recorded: '${status}' for routine.`);
        setTimeout(() => setAlertBanner(null), 4000);
        await fetchData();
      } else {
        alert(data.error || "Check-in failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateEscalate = async (occurrenceId: string) => {
    try {
      const res = await fetch("/api/care/escalate-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertBanner("CareLoop alert: Unconfirmed dose escalated to Caregiver Priya Sharma!");
        setTimeout(() => setAlertBanner(null), 5000);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClaimTask = async (taskId: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          taskId,
          caregiverName: "Priya Sharma, RN",
          actorRole: activeRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertBanner("Task claimed! Follow-up in progress.");
        setTimeout(() => setAlertBanner(null), 4000);
        await fetchData();
      } else {
        alert(data.error || "Failed to claim task");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleHandoffTask = async (taskId: string, toCaregiver: string, note: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "handoff",
          taskId,
          fromCaregiver: "Priya Sharma, RN",
          toCaregiver,
          note,
          actorRole: activeRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertBanner(`Task handed off to ${toCaregiver}.`);
        setTimeout(() => setAlertBanner(null), 4000);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveTask = async (
    taskId: string,
    outcome: CareTask["resolutionOutcome"],
    note: string
  ) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          taskId,
          outcome,
          note,
          actorName: "Priya Sharma, RN",
          actorRole: activeRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertBanner("CareLoop task resolved and closed. Audit trail updated.");
        setTimeout(() => setAlertBanner(null), 4000);
        await fetchData();
      } else {
        alert(data.error || "Failed to resolve task");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAppointment = async (
    appt: Omit<DoctorAppointment, "id" | "careProfileId">
  ) => {
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appt),
      });
      const data = await res.json();
      if (data.success) {
        setAlertBanner("New appointment scheduled!");
        setTimeout(() => setAlertBanner(null), 4000);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerTestEmail = async (email: string, type: string) => {
    const res = await fetch("/api/notifications/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientEmail: email,
        recipientRole: "Care Circle",
        type,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await fetchData();
    } else {
      throw new Error(data.error);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#f6f9f7] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-emerald-800">
          <div className="w-6 h-6 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium text-sm">Opening Guardian Oasis...</span>
        </div>
      </div>
    );
  }

  const openTasks = tasks.filter((t) => t.status === "OPEN" || t.status === "CLAIMED");

  return (
    <div className="min-h-screen bg-[#f6f9f7]">
      <Navbar
        activeRole={activeRole}
        onRoleChange={(role) => setActiveRole(role as UserRole)}
        unreadAlertsCount={notifications.length}
        onOpenEmailDrawer={() => setIsEmailDrawerOpen(true)}
        onOpenCareBrief={() => setIsBriefModalOpen(true)}
      />

      {alertBanner && (
        <div className="bg-[#2d4a3e] text-white px-4 py-2.5 text-center text-xs font-medium shadow-sm transition-all animate-in slide-in-from-top flex items-center justify-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{alertBanner}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ElderHeader
          profile={profile}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenAddAppointment={() => setIsAddApptModalOpen(true)}
          onOpenWhoCanSeeModal={() => setIsWhoCanSeeModalOpen(true)}
          activeMedCount={medications.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {openTasks.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                    <span>CareLoop Action Required ({openTasks.length} unconfirmed follow-up)</span>
                  </div>
                  <a
                    href="/caregiver"
                    className="text-xs text-rose-800 font-semibold hover:underline flex items-center space-x-1"
                  >
                    <span>Open Caregiver Inbox</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="space-y-3">
                  {openTasks.map((task) => (
                    <CareLoopTaskCard
                      key={task.id}
                      task={task}
                      activeRole={activeRole}
                      currentCaregiverName="Priya Sharma, RN"
                      onClaim={handleClaimTask}
                      onHandoff={handleHandoffTask}
                      onResolve={handleResolveTask}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-serif">
                    Today&apos;s Medication Routines
                  </h2>
                  <p className="text-xs text-gray-500">
                    Self-reported check-in with time-stamped audit protection
                  </p>
                </div>
                <button
                  onClick={() => handleSimulateEscalate("")}
                  className="inline-flex items-center space-x-1.5 text-xs text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
                  title="Simulate missed dose grace period timeout"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulate Missed Dose</span>
                </button>
              </div>

              <div className="space-y-3.5">
                {occurrences.map((occ) => (
                  <DoseCard
                    key={occ.id}
                    occurrence={occ}
                    activeRole={activeRole}
                    currentActorName={
                      activeRole === "owner" ? profile.displayName : "Sarah Thompson"
                    }
                    onCheckIn={handleCheckIn}
                    onSimulateEscalate={handleSimulateEscalate}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Grounded Daily Care Brief Preview */}
            <div className="bg-gradient-to-br from-[#2d4a3e] to-[#1e342b] text-white rounded-2xl p-5 shadow-sm border border-[#233a30]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <h3 className="font-bold text-sm">Daily Care Brief</h3>
                </div>
                <span className="text-[10px] bg-[#3d6554] px-2 py-0.5 rounded-full text-emerald-200">
                  Grounded AI
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 leading-relaxed mb-4">
                Structured digest drawn exclusively from Eleanor&apos;s verified routine check-ins and appointments.
              </p>

              {brief && (
                <div className="bg-[#243c32] p-3 rounded-xl border border-[#355848] text-xs font-mono text-emerald-100 mb-4 whitespace-pre-line">
                  {brief.summaryText.slice(0, 190)}...
                </div>
              )}

              <button
                onClick={() => setIsBriefModalOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5"
              >
                <span>Read Full Daily Brief</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Feature 7: Refill Runway Widget */}
            {refillRunways.length > 0 && (
              <RefillRunwayWidget runways={refillRunways} />
            )}

            {/* Upcoming Doctor Appointments card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 font-serif flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <span>Upcoming Visits</span>
                </h3>
                <button
                  onClick={() => setIsAddApptModalOpen(true)}
                  className="text-xs text-emerald-800 font-semibold hover:underline"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-3">
                {appointments.slice(0, 2).map((appt) => (
                  <div
                    key={appt.id}
                    className="p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 mb-1">
                      <span>{appt.dateLabel} • {appt.timeLabel}</span>
                      {appt.transportAssigned ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full inline-flex items-center space-x-1">
                          <Car className="w-2.5 h-2.5" />
                          <span>Ride Ready</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full">
                          Ride Needed
                        </span>
                      )}
                    </div>

                    <div className="font-bold text-xs text-gray-900">
                      {appt.doctorName}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {appt.specialty} • {appt.clinicName}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vitals & Alerts widget matching mockup */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 font-serif mb-3 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                <span>Today&apos;s Alerts & Health Logs</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center space-x-2 text-rose-900">
                    <Heart className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-semibold block">High Heart Rate Flag</span>
                      <span className="text-[11px] text-rose-700">98 bpm at 4:56 PM • Rested</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">4:56 PM</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center space-x-2 text-gray-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold block">Blood Pressure Check</span>
                      <span className="text-[11px] text-gray-500">124 / 80 mmHg • In Target</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">8:15 AM</span>
                </div>
              </div>
            </div>

            {/* Smart Care Innovation Hub: MedSutra AI & Caregiver Wellbeing */}
            <div className="bg-gradient-to-br from-[#243e33] to-[#1c3027] text-white rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <h3 className="text-sm font-bold font-serif text-white">
                  Smart Care Orbit AI
                </h3>
              </div>
              <p className="text-xs text-emerald-100/80 leading-relaxed">
                Parse Rx prescriptions with Gemini or track daily caregiver stress & burnout risk.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href="/medsutra"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-3 rounded-xl text-center transition-all flex items-center justify-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>MedSutra AI</span>
                </a>
                <a
                  href="/wellbeing"
                  className="bg-[#2f4d40] hover:bg-[#395c4e] text-emerald-100 text-xs font-semibold py-2 px-3 rounded-xl text-center border border-[#446d5c] transition-all flex items-center justify-center space-x-1"
                >
                  <Heart className="w-3.5 h-3.5 text-rose-300" />
                  <span>Wellbeing</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <EmailNotificationDrawer
        isOpen={isEmailDrawerOpen}
        onClose={() => setIsEmailDrawerOpen(false)}
        notifications={notifications}
        onTriggerTestEmail={handleTriggerTestEmail}
      />

      <DailyCareBriefModal
        isOpen={isBriefModalOpen}
        onClose={() => setIsBriefModalOpen(false)}
        brief={brief}
      />

      <AddAppointmentModal
        isOpen={isAddApptModalOpen}
        onClose={() => setIsAddApptModalOpen(false)}
        onAdd={handleAddAppointment}
      />

      <WhoCanSeeModal
        isOpen={isWhoCanSeeModalOpen}
        onClose={() => setIsWhoCanSeeModalOpen(false)}
        profile={profile}
        members={members}
      />
    </div>
  );
}
