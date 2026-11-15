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
  Mic,
  Languages,
} from "lucide-react";
import { CareProfile, CareMember, DoseOccurrence, DoctorAppointment, DoseStatus } from "@/types";

export default function ElderTodayPage() {
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [members, setMembers] = useState<CareMember[]>([]);
  const [occurrences, setOccurrences] = useState<DoseOccurrence[]>([]);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [isWhoCanSeeOpen, setIsWhoCanSeeOpen] = useState(false);
  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);
  const [locale, setLocale] = useState<"en" | "hi">("en");
  const [listening, setListening] = useState(false);
  const [doNotNotify, setDoNotNotify] = useState(false);
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

  const t = {
    calmView: locale === "hi" ? "बुजुर्ग सरल दृश्य" : "Senior Calm View",
    goodDay: locale === "hi" ? "नमस्ते, " : "Good day, ",
    nextRoutine: locale === "hi" ? "अगली दवाई" : "Next Routine",
    instructions: locale === "hi" ? "निर्देश" : "Instructions",
    dosage: locale === "hi" ? "मात्रा" : "Dosage",
    readAloud: locale === "hi" ? "बोलकर बताएं" : "Read Aloud",
    voiceInput: locale === "hi" ? "आवाज़ से बोलें" : "Voice Command",
    markedTaken: locale === "hi" ? "दवाई ले ली" : "Marked Taken",
    remindLater: locale === "hi" ? "बाद में याद दिलाएं" : "Remind Me Later",
    needHelp: locale === "hi" ? "मदद चाहिए" : "I Need Help",
    notSure: locale === "hi" ? "पक्का नहीं पता" : "Not Sure",
    silentCheck:
      locale === "hi"
        ? "परिवार को सूचित न करें (निजी)"
        : "Do not notify family for this routine (private)",
    laterToday: locale === "hi" ? "आज बाद में" : "Later Today",
    nextAppt: locale === "hi" ? "डॉक्टर से अगली मुलाकात" : "Next Doctor Appointment",
  };

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
          doNotNotifyFamily: doNotNotify,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const label =
          status === "MARKED_TAKEN"
            ? locale === "hi"
              ? `धन्यवाद। दवाई ${time} पर दर्ज की गई।`
              : `Thank you, Eleanor. Marked taken at ${time}.`
            : status === "SNOOZED"
            ? locale === "hi"
              ? `हम आपको 15 मिनट में याद दिलाएंगे।`
              : `We'll remind you in 15 minutes.`
            : status === "NOT_SURE"
            ? locale === "hi"
              ? `दर्ज किया गया: पक्का नहीं पता। देखभाल दल को सूचित किया गया।`
              : `Recorded: Not sure. Caregiver alerted to check with you.`
            : locale === "hi"
            ? `आपकी देखभाल टीम को सूचित कर दिया गया है।`
            : `Your care team has been notified. Someone will assist you shortly.`;

        setLastActionMsg(label);

        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(label);
          utterance.rate = 0.9;
          utterance.lang = locale === "hi" ? "hi-IN" : "en-US";
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
      const text =
        locale === "hi"
          ? `नमस्ते। आपकी अगली दवाई ${occ.medicationName} है। समय: ${occ.scheduledTime}। निर्देश: ${occ.instructions}`
          : `Good day, Eleanor. Your next medicine is ${occ.medicationName}, ${occ.doseText}, scheduled for ${occ.scheduledTime}. Instructions: ${occ.instructions}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.lang = locale === "hi" ? "hi-IN" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  // Low friction voice intent recognition
  const handleVoiceListen = () => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = locale === "hi" ? "hi-IN" : "en-US";
      recognition.start();
      setListening(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        setListening(false);
        const occ = occurrences.find((o) => o.status !== "MARKED_TAKEN") || occurrences[0];
        if (!occ) return;

        if (transcript.includes("taken") || transcript.includes("took") || transcript.includes("ली") || transcript.includes("खा ली")) {
          handleAction(occ.id, "MARKED_TAKEN");
        } else if (transcript.includes("later") || transcript.includes("snooze") || transcript.includes("बाद में")) {
          handleAction(occ.id, "SNOOZED");
        } else if (transcript.includes("help") || transcript.includes("मदद")) {
          handleAction(occ.id, "NEEDS_HELP");
        } else if (transcript.includes("sure") || transcript.includes("पता नहीं")) {
          handleAction(occ.id, "NOT_SURE");
        } else {
          alert(`Heard: "${transcript}". Please tap an action button below.`);
        }
      };

      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
    } else {
      alert("Speech recognition is not supported in this browser. Please use the large buttons below.");
    }
  };

  const nextDue = occurrences.find((o) => o.status !== "MARKED_TAKEN") || occurrences[0];
  const upcomingAppt = appointments[0];

  return (
    <div className="min-h-screen bg-[#f4f7f5] pb-12">
      <Navbar activeRole="owner" onRoleChange={() => {}} />

      {lastActionMsg && (
        <div className="bg-[#2d4a3e] text-white p-4 text-center text-sm font-semibold shadow-md flex items-center justify-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span>{lastActionMsg}</span>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Welcome Card & Language Switcher */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-100 mb-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
                  {t.calmView}
                </span>
                {/* Feature 8: Language toggle */}
                <button
                  onClick={() => setLocale(locale === "en" ? "hi" : "en")}
                  className="inline-flex items-center space-x-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-0.5 rounded-full transition-colors"
                  title="Switch between English and Hindi"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>{locale === "en" ? "हिंदी (Hindi)" : "English"}</span>
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 mt-2">
                {t.goodDay} {profile?.displayName || "Eleanor"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {locale === "hi"
                  ? "यह आपकी अगली दवाई है। जब आप तैयार हों, नीचे दिए गए बटन पर टैप करें।"
                  : "Here is your next care routine. Tap below when you are ready."}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsWhoCanSeeOpen(true)}
                className="inline-flex items-center space-x-1.5 text-xs text-emerald-900 bg-[#eef5f1] hover:bg-emerald-100 px-4 py-2 rounded-full border border-emerald-200 transition-colors"
              >
                <Shield className="w-4 h-4 text-emerald-700" />
                <span>Who can see this?</span>
              </button>
            </div>
          </div>
        </div>

        {/* The NEXT DUE ROUTINE Card */}
        {nextDue && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border-2 border-[#2d4a3e] mb-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg">
                {t.nextRoutine} • {nextDue.scheduledTime}
              </span>

              <div className="flex items-center space-x-2">
                {/* Feature 8: Voice Command Mic */}
                <button
                  onClick={handleVoiceListen}
                  className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                    listening
                      ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  }`}
                  title="Speak check-in command"
                >
                  <Mic className="w-4 h-4" />
                  <span>{listening ? "Listening..." : t.voiceInput}</span>
                </button>

                <button
                  onClick={() => speakNextRoutine(nextDue)}
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors"
                >
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span>{t.readAloud}</span>
                </button>
              </div>
            </div>

            <div className="my-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {nextDue.medicationName}
              </h2>
              <div className="text-base text-gray-600 font-medium mt-1">
                {t.dosage}: <strong className="text-gray-900">{nextDue.doseText}</strong>
              </div>
              <div className="text-sm text-gray-500 mt-2 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                {t.instructions}: {nextDue.instructions}
              </div>

              {nextDue.status === "MARKED_TAKEN" && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-900 font-semibold rounded-xl text-sm flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  <span>Marked as taken for today ({nextDue.updatedAt})</span>
                </div>
              )}
            </div>

            {/* Feature 2: Elder Privacy Setting */}
            <div className="mb-4 flex items-center justify-between text-xs text-gray-500 p-2.5 bg-gray-50 rounded-xl">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={doNotNotify}
                  onChange={(e) => setDoNotNotify(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500"
                />
                <span>{t.silentCheck}</span>
              </label>
            </div>

            {/* Giant Accessible Buttons (56px) */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleAction(nextDue.id, "MARKED_TAKEN")}
                className="w-full min-h-[56px] text-lg font-bold bg-[#2d4a3e] hover:bg-[#385c4c] text-white rounded-2xl shadow-md flex items-center justify-center space-x-3 transition-transform active:scale-[0.98] focus:ring-4 focus:ring-emerald-300"
              >
                <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                <span>{t.markedTaken}</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleAction(nextDue.id, "SNOOZED")}
                  className="min-h-[52px] text-base font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-2xl flex items-center justify-center space-x-2 transition-colors active:scale-[0.98]"
                >
                  <Clock className="w-5 h-5 text-amber-700" />
                  <span>{t.remindLater}</span>
                </button>

                <button
                  onClick={() => handleAction(nextDue.id, "NOT_SURE")}
                  className="min-h-[52px] text-base font-semibold bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-2 border-yellow-300 rounded-2xl flex items-center justify-center space-x-2 transition-colors active:scale-[0.98]"
                >
                  <HelpCircle className="w-5 h-5 text-yellow-700" />
                  <span>{t.notSure}</span>
                </button>

                <button
                  onClick={() => handleAction(nextDue.id, "NEEDS_HELP")}
                  className="min-h-[52px] text-base font-semibold bg-rose-50 hover:bg-rose-100 text-rose-900 border-2 border-rose-300 rounded-2xl flex items-center justify-center space-x-2 transition-colors active:scale-[0.98]"
                >
                  <HelpCircle className="w-5 h-5 text-rose-700" />
                  <span>{t.needHelp}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Later Today Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 mb-6">
          <h3 className="text-base font-bold text-gray-900 font-serif mb-3">
            {t.laterToday}
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
                  ) : item.status === "NOT_SURE" ? (
                    <span className="text-xs font-semibold text-yellow-800 bg-yellow-100 px-2.5 py-1 rounded-full border border-yellow-200">
                      Not Sure
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
              <span>{t.nextAppt}</span>
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
