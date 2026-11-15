"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { WhoCanSeeModal } from "@/components/WhoCanSeeModal";
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Volume2,
  Shield,
  Heart,
  Pill,
  Calendar,
  AlertTriangle,
  ArrowRight,
  PhoneCall,
} from "lucide-react";
import { CareProfile, CareMember, DoseOccurrence, DoctorAppointment, DoseStatus } from "@/types";

export default function ElderTodayPage() {
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [members, setMembers] = useState<CareMember[]>([]);
  const [occurrences, setOccurrences] = useState<DoseOccurrence[]>([]);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [isWhoCanSeeOpen, setIsWhoCanSeeOpen] = useState(false);
  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/care/today");
      const json = await res.json();
      if (json.success) {
        setProfile(json.data.profile);
        setMembers(json.data.members);
        setOccurrences(json.data.occurrences);
        setAppointments(json.data.appointments);
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

  const handleAction = async (occurrenceId: string, status: DoseStatus) => {
    try {
      const res = await fetch("/api/doses/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceId,
          status,
          actorName: profile?.displayName || "Eleanor Thompson",
          actorRole: "owner",
        }),
      });
      const data = await res.json();
      if (data.success) {
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const label =
          status === "MARKED_TAKEN"
            ? `Thank you, Eleanor. Marked taken at ${time}.`
            : status === "SNOOZED"
            ? `We'll remind you in 15 minutes.`
            : `Your care team has been notified. Someone will assist you shortly.`;
        setLastActionMsg(label);

        // Voice confirmation
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(label);
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }

        setTimeout(() => setLastActionMsg(null), 5000);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const speakNextRoutine = (occ: DoseOccurrence) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const text = `Good day, Eleanor. Your next medicine is ${occ.medicationName}, ${occ.doseText}, scheduled for ${occ.scheduledTime}. Instructions: ${occ.instructions}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const nextDue = occurrences.find((o) => o.status !== "MARKED_TAKEN") || occurrences[0];
  const upcomingAppt = appointments[0];

  return (
    <div className="min-h-screen bg-[#f4f7f5] pb-12">
      {/* Navbar with role set to owner */}
      <Navbar activeRole="owner" onRoleChange={() => {}} />

      {/* Confirmation Banner */}
      {lastActionMsg && (
        <div className="bg-[#2d4a3e] text-white p-4 text-center text-sm font-semibold shadow-md flex items-center justify-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span>{lastActionMsg}</span>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Welcome Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-100 mb-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
                Senior Calm View
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 mt-2">
                Good day, {profile?.displayName || "Eleanor"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Here is your next care routine. Tap below when you are ready.
              </p>
            </div>

            <button
              onClick={() => setIsWhoCanSeeOpen(true)}
              className="inline-flex items-center space-x-1.5 text-xs text-emerald-900 bg-[#eef5f1] hover:bg-emerald-100 px-4 py-2 rounded-full border border-emerald-200 transition-colors"
            >
              <Shield className="w-4 h-4 text-emerald-700" />
              <span>Who can see this?</span>
            </button>
          </div>
        </div>

        {/* The NEXT DUE ROUTINE Card — Big, high-contrast accessible card */}
        {nextDue && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border-2 border-[#2d4a3e] mb-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg">
                  Next Routine • {nextDue.scheduledTime}
                </span>
              </div>
              <button
                onClick={() => speakNextRoutine(nextDue)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors"
              >
                <Volume2 className="w-4 h-4 text-emerald-700" />
                <span>Read Aloud</span>
              </button>
            </div>

            <div className="my-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {nextDue.medicationName}
              </h2>
              <div className="text-base text-gray-600 font-medium mt-1">
                Dosage: <strong className="text-gray-900">{nextDue.doseText}</strong>
              </div>
              <div className="text-sm text-gray-500 mt-2 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                Instructions: {nextDue.instructions}
              </div>

              {nextDue.status === "MARKED_TAKEN" && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-900 font-semibold rounded-xl text-sm flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  <span>Marked as taken for today ({nextDue.updatedAt})</span>
                </div>
              )}
            </div>

            {/* Giant Accessible Buttons (Minimum 56px height for reduced motor dexterity) */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleAction(nextDue.id, "MARKED_TAKEN")}
                className="w-full min-h-[56px] text-lg font-bold bg-[#2d4a3e] hover:bg-[#385c4c] text-white rounded-2xl shadow-md flex items-center justify-center space-x-3 transition-transform active:scale-[0.98] focus:ring-4 focus:ring-emerald-300"
              >
                <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                <span>Marked Taken</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAction(nextDue.id, "SNOOZED")}
                  className="min-h-[52px] text-base font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-2xl flex items-center justify-center space-x-2 transition-colors active:scale-[0.98]"
                >
                  <Clock className="w-5 h-5 text-amber-700" />
                  <span>Remind me later</span>
                </button>

                <button
                  onClick={() => handleAction(nextDue.id, "NEEDS_HELP")}
                  className="min-h-[52px] text-base font-semibold bg-rose-50 hover:bg-rose-100 text-rose-900 border-2 border-rose-300 rounded-2xl flex items-center justify-center space-x-2 transition-colors active:scale-[0.98]"
                >
                  <HelpCircle className="w-5 h-5 text-rose-700" />
                  <span>I need help</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Later Today Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 mb-6">
          <h3 className="text-base font-bold text-gray-900 font-serif mb-3">
            Later Today & Upcoming
          </h3>

          <div className="space-y-3">
            {occurrences.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#fafcfb] border border-gray-100"
              >
                <div>
                  <div className="text-xs font-semibold text-emerald-900">
                    {item.scheduledTime}
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {item.medicationName} ({item.doseText})
                  </div>
                </div>

                <div>
                  {item.status === "MARKED_TAKEN" ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Taken
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Doctor Appointment Card */}
        {upcomingAppt && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
              <Calendar className="w-4 h-4" />
              <span>Next Doctor Appointment</span>
            </div>
            <h4 className="text-lg font-bold text-gray-900">
              {upcomingAppt.doctorName}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              {upcomingAppt.dateLabel} at {upcomingAppt.timeLabel} • {upcomingAppt.clinicName}
            </p>
            {upcomingAppt.transportDetails && (
              <div className="mt-3 p-3 bg-emerald-50 rounded-xl text-xs text-emerald-900 font-medium">
                🚗 {upcomingAppt.transportDetails}
              </div>
            )}
          </div>
        )}
      </main>

      <WhoCanSeeModal
        isOpen={isWhoCanSeeOpen}
        onClose={() => setIsWhoCanSeeOpen(false)}
        profile={profile || ({} as any)}
        members={members}
      />
    </div>
  );
}
