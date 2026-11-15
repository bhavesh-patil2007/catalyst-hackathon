"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Heart,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Shield,
  Coffee,
  Sparkles,
  Users,
  Activity,
  Calendar,
  Lock,
  ArrowRight,
} from "lucide-react";
import type { WellbeingCheckIn } from "@/lib/wellbeingStore";

const CAREGIVER_ID = "caregiver-priya";

interface EmojiSelectorProps {
  options: { emoji: string; label: string }[];
  value: number;
  onChange: (val: number) => void;
  name: string;
}

function EmojiSelector({ options, value, onChange, name }: EmojiSelectorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label={name}>
      {options.map((opt, i) => {
        const val = (i + 1) as 1 | 2 | 3 | 4 | 5;
        const isSelected = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            aria-label={`${name}: ${opt.label}`}
            aria-pressed={isSelected}
            className={`text-2xl p-2.5 rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
              isSelected
                ? "ring-2 ring-emerald-600 bg-emerald-50 scale-105 shadow-xs"
                : "hover:bg-slate-100 opacity-60 hover:opacity-100 bg-gray-50/70"
            }`}
          >
            {opt.emoji}
          </button>
        );
      })}
    </div>
  );
}

export default function WellbeingPage() {
  const [sleepHours, setSleepHours] = useState(7);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [stress, setStress] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [note, setNote] = useState("");
  const [shareWithFamily, setShareWithFamily] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<WellbeingCheckIn[]>([]);
  const [burnoutRisk, setBurnoutRisk] = useState<"low" | "moderate" | "high" | null>(null);
  const [trendView, setTrendView] = useState<"7day" | "30day">("7day");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [requestingBackup, setRequestingBackup] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/wellbeing/history?caregiverId=${CAREGIVER_ID}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history ?? []);
        setBurnoutRisk(data.burnoutRisk ?? null);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/wellbeing/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caregiverId: CAREGIVER_ID,
          sleepHours,
          mood,
          stress,
          energy,
          note: note.trim() || undefined,
          shareWithFamily,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error ?? "Failed to save check-in", "error");
        return;
      }

      const data = await res.json();
      setBurnoutRisk(data.burnoutRisk);
      showToast("Daily wellbeing check-in saved securely 💚", "success");
      setNote("");
      await loadHistory();
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestBackup = async () => {
    setRequestingBackup(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backup_request",
          type: "BACKUP_REQUEST",
          caregiverName: "Priya Sharma, RN",
          reason: "Caregiver wellbeing trend indicates elevated fatigue & workload. Relief coverage requested.",
        }),
      });

      if (res.ok) {
        setBackupSuccess(true);
        showToast("CareLoop urgent task created for backup coverage.", "success");
      } else {
        showToast("Could not submit backup request.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setRequestingBackup(false);
    }
  };

  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  const dotColor = (avg: number | null) => {
    if (avg === null) return "bg-gray-200";
    if (avg >= 3.5) return "bg-emerald-500";
    if (avg >= 2.5) return "bg-amber-400";
    return "bg-rose-500";
  };

  return (
    <div className="min-h-screen bg-[#f6f9f7] pb-16">
      <Navbar activeRole="caregiver" onRoleChange={() => {}} />

      {toast && (
        <div
          role="alert"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-white text-xs font-semibold ${
            toast.type === "success" ? "bg-[#2d4a3e]" : "bg-rose-700"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold text-emerald-800 mb-2">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Caregiver Health & Workload Protection</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 tracking-tight">
              Caregiver Wellbeing & Workload Hub
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-600 max-w-xl leading-relaxed">
              Sustainable care starts with the caregiver. Check in daily on sleep, stress, and energy to spot workload fatigue before burnout happens.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center space-x-3 text-xs text-gray-600">
            <Lock className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold text-gray-900 block">Private by Default</span>
              <span>Your responses remain confidential unless you check &quot;Share with Family&quot;.</span>
            </div>
          </div>
        </div>

        {/* Non-Diagnostic Guardrail Notice */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 mb-8 text-xs text-amber-900 flex items-start space-x-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Ethical &amp; Non-Diagnostic Notice:</strong> Caregiver workload indicators are reflective personal check-ins designed to support balanced shift coverage. They are not medical, psychiatric, or clinical diagnoses of burnout.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Check-In Form (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-serif font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
              <span>Today&apos;s Wellbeing Check-In</span>
              <span className="text-xs text-gray-400 font-sans font-normal">Caregiver: Priya Sharma, RN</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sleep slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-800">
                    Sleep Quality &amp; Rest ({sleepHours} Hours)
                  </label>
                  <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                    {sleepHours >= 7 ? "Well Rested" : sleepHours >= 5 ? "Moderate Rest" : "Short Sleep"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full accent-emerald-700 h-2 bg-gray-100 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0 hrs</span>
                  <span>6 hrs (Target minimum)</span>
                  <span>12 hrs</span>
                </div>
              </div>

              {/* Mood */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">
                  General Mood &amp; Outlook
                </label>
                <EmojiSelector
                  name="Mood"
                  options={[
                    { emoji: "😞", label: "Very Low" },
                    { emoji: "😕", label: "Low" },
                    { emoji: "😐", label: "Neutral" },
                    { emoji: "🙂", label: "Good" },
                    { emoji: "😊", label: "Very Good" },
                  ]}
                  value={mood}
                  onChange={(v) => setMood(v as any)}
                />
              </div>

              {/* Stress Level */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">
                  Stress &amp; Emotional Strain
                </label>
                <EmojiSelector
                  name="Stress"
                  options={[
                    { emoji: "😰", label: "Very High Strain" },
                    { emoji: "😟", label: "Elevated" },
                    { emoji: "😐", label: "Moderate" },
                    { emoji: "😌", label: "Calm" },
                    { emoji: "😄", label: "Very Calm & Centered" },
                  ]}
                  value={stress}
                  onChange={(v) => setStress(v as any)}
                />
              </div>

              {/* Energy Level */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">
                  Physical Energy &amp; Stamina
                </label>
                <EmojiSelector
                  name="Energy"
                  options={[
                    { emoji: "😴", label: "Exhausted" },
                    { emoji: "😪", label: "Tired" },
                    { emoji: "😐", label: "Moderate" },
                    { emoji: "⚡", label: "Energetic" },
                    { emoji: "✨", label: "Fully Energized" },
                  ]}
                  value={energy}
                  onChange={(v) => setEnergy(v as any)}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Optional Reflection / Routine Handover Notes
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Afternoon shift was smooth. Eleanor walked in garden; needed minor reassurance with knee mobility."
                  className="w-full text-xs border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Privacy / Consent Checkbox */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    Share wellbeing status with Family Manager?
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Allows Sarah Thompson to see when relief coverage or rest is needed.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={shareWithFamily}
                  onChange={(e) => setShareWithFamily(e.target.checked)}
                  className="w-5 h-5 accent-emerald-700 rounded-md cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#2d4a3e] hover:bg-[#385b4c] text-white py-3.5 rounded-xl font-semibold text-xs shadow-xs transition-colors flex items-center justify-center space-x-2"
              >
                {submitting ? "Saving Check-In..." : "Save Today's Check-In"}
              </button>
            </form>
          </div>

          {/* Right Column: Trends & CareLoop Relief Trigger */}
          <div className="space-y-6">
            {/* 7-Day & 30-Day Trend Panel */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h3 className="font-serif font-bold text-sm text-gray-900 flex items-center space-x-1.5">
                  <Activity className="w-4 h-4 text-emerald-700" />
                  <span>Workload &amp; Fatigue Trends</span>
                </h3>
                <div className="inline-flex text-[10px] bg-gray-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => setTrendView("7day")}
                    className={`px-2 py-0.5 rounded-md ${
                      trendView === "7day" ? "bg-white text-gray-900 font-bold shadow-xs" : "text-gray-500"
                    }`}
                  >
                    7-Day
                  </button>
                  <button
                    onClick={() => setTrendView("30day")}
                    className={`px-2 py-0.5 rounded-md ${
                      trendView === "30day" ? "bg-white text-gray-900 font-bold shadow-xs" : "text-gray-500"
                    }`}
                  >
                    30-Day
                  </button>
                </div>
              </div>

              {/* Trend visual */}
              {trendView === "7day" ? (
                <div className="flex justify-between items-end gap-1 pt-2">
                  {days7.map((date) => {
                    const entry = history.find((h) => h.date === date);
                    const avg = entry ? (entry.mood + entry.energy) / 2 : null;
                    const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" });
                    return (
                      <div key={date} className="flex flex-col items-center gap-1.5 flex-1">
                        <div
                          className={`w-6 h-6 rounded-full ${dotColor(avg)} border-2 border-white shadow-xs flex items-center justify-center text-[9px] text-white font-bold`}
                        >
                          {entry ? `${entry.sleepHours}h` : "—"}
                        </div>
                        <span className="text-[10px] text-gray-400 font-semibold">{dayLabel}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded-2xl text-xs text-gray-600 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Logged Check-Ins:</span>
                    <strong>{history.length} of last 30 days</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Sleep:</span>
                    <strong>
                      {history.length > 0
                        ? (history.reduce((a, b) => a + b.sleepHours, 0) / history.length).toFixed(1) + " hrs"
                        : "7.0 hrs"}
                    </strong>
                  </div>
                </div>
              )}

              {/* Workload Risk Indicator */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Rolling Workload Risk Indicator
                </span>
                {burnoutRisk === "high" ? (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-bold">Elevated Workload &bull; Relief Coverage Recommended</span>
                  </div>
                ) : burnoutRisk === "moderate" ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-2xl text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Monitor Shift Load &bull; Take scheduled rest breaks</span>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">Balanced Workload &bull; Sustainable Shift Pace</span>
                  </div>
                )}
              </div>

              {/* CareLoop Backup Relief Button */}
              <div className="pt-2">
                {backupSuccess ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Backup request active in CareLoop Inbox</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBackup}
                    disabled={requestingBackup}
                    className="w-full bg-[#243e33] hover:bg-[#1a2e26] text-white p-3 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-2"
                  >
                    <Users className="w-4 h-4 text-emerald-300" />
                    <span>{requestingBackup ? "Dispatching..." : "Request Backup Coverage (CareLoop)"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Evidence-Based Personal Support Recommendations */}
            <div className="bg-gradient-to-br from-emerald-50/80 to-white rounded-3xl border border-emerald-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <Coffee className="w-4 h-4 text-emerald-700" />
                <h3 className="font-serif font-bold text-sm text-gray-900">
                  Caregiver Resilience Suggestions
                </h3>
              </div>
              <ul className="text-xs text-gray-600 space-y-2 leading-relaxed">
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-700 font-bold">&bull;</span>
                  <span><strong>15-Minute Recovery:</strong> Step outside after morning routine handover for sunlight &amp; hydration.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-700 font-bold">&bull;</span>
                  <span><strong>CareLoop Relay:</strong> If an afternoon doctor escort overlaps medication window, hand off to Sarah Thompson via CareLoop relay.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-700 font-bold">&bull;</span>
                  <span><strong>Evening Wind-Down:</strong> Avoid administrative charting within 45 minutes of bedtime.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
