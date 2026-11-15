"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Heart, CheckCircle, AlertTriangle, AlertCircle, Shield } from "lucide-react";
import type { WellbeingCheckIn } from "@/lib/wellbeingStore";

const CAREGIVER_ID = "caregiver-priya";

// ─── Emoji Selector ─────────────────────────────────────────────────────────
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
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(val);
              }
            }}
            aria-label={`${name}: ${opt.label}`}
            aria-pressed={isSelected}
            className={`text-3xl p-2 rounded-xl transition-all focus:outline-none focus:ring-4 focus:ring-emerald-400 ${
              isSelected
                ? "ring-4 ring-emerald-500 bg-emerald-50 scale-110 shadow-md"
                : "hover:bg-slate-100 opacity-60 hover:opacity-100"
            }`}
          >
            {opt.emoji}
          </button>
        );
      })}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${
        type === "success" ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}

// ─── Trend Panel ─────────────────────────────────────────────────────────────
interface TrendPanelProps {
  history: WellbeingCheckIn[];
  burnoutRisk: "low" | "moderate" | "high" | null;
  onRequestBackup: () => void;
  requesting: boolean;
}

function TrendPanel({ history, burnoutRisk, onRequestBackup, requesting }: TrendPanelProps) {
  // Build last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  const riskConfig = {
    low: { label: "Low Risk", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <CheckCircle className="w-4 h-4" /> },
    moderate: { label: "Monitor", color: "bg-amber-100 text-amber-800 border-amber-300", icon: <AlertTriangle className="w-4 h-4" /> },
    high: { label: "High Risk — Consider requesting backup", color: "bg-red-100 text-red-800 border-red-300", icon: <AlertCircle className="w-4 h-4" /> },
  };

  function dotColor(avg: number | null) {
    if (avg === null) return "bg-slate-200";
    if (avg >= 3.5) return "bg-emerald-500";
    if (avg >= 2.5) return "bg-amber-400";
    return "bg-red-500";
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#2d4a3e] font-serif flex items-center gap-2">
        <span>7-Day Wellbeing Trend</span>
      </h2>

      {/* Day columns */}
      <div className="flex justify-between gap-1">
        {days.map((date) => {
          const entry = history.find((h) => h.date === date);
          const avg = entry ? (entry.mood + entry.energy) / 2 : null;
          const shortDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return (
            <div key={date} className="flex flex-col items-center gap-2 flex-1" title={shortDate}>
              <div
                className={`w-5 h-5 rounded-full ${dotColor(avg)} border-2 border-white shadow`}
                aria-label={`${shortDate}: ${avg !== null ? avg.toFixed(1) : "No data"}`}
              />
              <span className="text-[10px] text-slate-400 text-center leading-tight">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              {entry && (
                <span className="text-[9px] text-slate-500">
                  😴{entry.sleepHours}h
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Good</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Monitor</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Low</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-200 inline-block" /> No data</span>
      </div>

      {/* Burnout Risk Badge */}
      {burnoutRisk && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${riskConfig[burnoutRisk].color}`}>
          {riskConfig[burnoutRisk].icon}
          <span>{riskConfig[burnoutRisk].label}</span>
        </div>
      )}

      {/* Request Backup button (only if high) */}
      {burnoutRisk === "high" && (
        <button
          onClick={onRequestBackup}
          disabled={requesting}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-red-300 disabled:opacity-60"
        >
          {requesting ? "Requesting…" : "Request Backup Caregiver"}
        </button>
      )}

      {/* Consent notice */}
      <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 mt-auto">
        <Shield className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Your check-in is <strong>private</strong> unless you choose to share it with your family manager.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const MOOD_OPTIONS = [
  { emoji: "😞", label: "Very sad" },
  { emoji: "😕", label: "Sad" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😊", label: "Very good" },
];

const STRESS_OPTIONS = [
  { emoji: "😰", label: "Very stressed" },
  { emoji: "😟", label: "Stressed" },
  { emoji: "😐", label: "Moderate" },
  { emoji: "😌", label: "Relaxed" },
  { emoji: "😄", label: "Very relaxed" },
];

const ENERGY_OPTIONS = [
  { emoji: "😴", label: "Exhausted" },
  { emoji: "😪", label: "Very tired" },
  { emoji: "😐", label: "Moderate" },
  { emoji: "⚡", label: "Energized" },
  { emoji: "✨", label: "Very energized" },
];

export default function WellbeingPage() {
  // Form state
  const [sleepHours, setSleepHours] = useState(7);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [stress, setStress] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [note, setNote] = useState("");
  const [shareWithFamily, setShareWithFamily] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // History / risk state
  const [history, setHistory] = useState<WellbeingCheckIn[]>([]);
  const [burnoutRisk, setBurnoutRisk] = useState<"low" | "moderate" | "high" | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Backup request
  const [requesting, setRequesting] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
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
      showToast("Check-in saved! Take care of yourself 💚", "success");
      setNote("");
      setShareWithFamily(false);
      await loadHistory();
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestBackup = async () => {
    setRequesting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "BACKUP_REQUEST",
          title: "Backup caregiver support requested",
          assignedTo: null,
          reason: "Caregiver wellbeing score indicates burnout risk",
        }),
      });
      if (res.ok) {
        showToast("Backup request submitted to care team.", "success");
      } else {
        showToast("Could not submit request. Please try again.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-[#2d4a3e] text-white py-8 px-4 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="w-12 h-12 bg-emerald-700/50 rounded-2xl flex items-center justify-center border border-emerald-600">
            <Heart className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif leading-tight">Caregiver Wellbeing</h1>
            <p className="text-emerald-200 text-sm mt-0.5">
              Your wellbeing matters for quality care
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Check-in form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6"
            noValidate
          >
            <h2 className="text-xl font-semibold text-[#2d4a3e] font-serif">Today&apos;s Check-in</h2>

            {/* Sleep hours */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3" htmlFor="sleep-slider">
                Sleep Hours
                <span className="ml-3 inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {sleepHours} hours
                </span>
              </label>
              <input
                id="sleep-slider"
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={sleepHours}
                onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none bg-emerald-100 accent-emerald-600 cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-300"
                aria-label={`Sleep hours: ${sleepHours}`}
                aria-valuemin={0}
                aria-valuemax={12}
                aria-valuenow={sleepHours}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
              </div>
            </div>

            {/* Mood */}
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-3">How are you feeling today?</span>
              <EmojiSelector
                name="Mood"
                options={MOOD_OPTIONS}
                value={mood}
                onChange={(v) => setMood(v as 1 | 2 | 3 | 4 | 5)}
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                <span>Very bad</span>
                <span>Very good</span>
              </div>
            </div>

            {/* Stress */}
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-3">Stress level today?</span>
              <EmojiSelector
                name="Stress"
                options={STRESS_OPTIONS}
                value={stress}
                onChange={(v) => setStress(v as 1 | 2 | 3 | 4 | 5)}
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                <span>Very high stress</span>
                <span>Very low stress</span>
              </div>
            </div>

            {/* Energy */}
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-3">Energy level?</span>
              <EmojiSelector
                name="Energy"
                options={ENERGY_OPTIONS}
                value={energy}
                onChange={(v) => setEnergy(v as 1 | 2 | 3 | 4 | 5)}
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                <span>Exhausted</span>
                <span>Energized</span>
              </div>
            </div>

            {/* Note */}
            <div>
              <label htmlFor="wellbeing-note" className="block text-sm font-semibold text-slate-700 mb-2">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="wellbeing-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything on your mind today?"
                maxLength={500}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 focus:border-emerald-400 resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Share with family */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shareWithFamily}
                onChange={(e) => setShareWithFamily(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded focus:ring-4 focus:ring-emerald-300"
                aria-label="Share summary with family manager"
              />
              <span className="text-sm text-slate-700 font-medium">
                Share summary with family manager
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-base font-semibold py-4 rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-300"
              aria-label="Save today's wellbeing check-in"
            >
              {submitting ? "Saving…" : "💚 Save Today's Check-in"}
            </button>
          </form>

          {/* RIGHT: 7-day trend */}
          <div className="lg:col-span-2">
            <TrendPanel
              history={history}
              burnoutRisk={burnoutRisk}
              onRequestBackup={handleRequestBackup}
              requesting={requesting}
            />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
