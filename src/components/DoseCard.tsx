"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  Volume2,
  Pill,
  ChevronRight,
  Info,
} from "lucide-react";
import { DoseOccurrence, DoseStatus, UserRole } from "@/types";

interface DoseCardProps {
  occurrence: DoseOccurrence;
  activeRole: UserRole;
  currentActorName: string;
  onCheckIn: (
    occurrenceId: string,
    status: DoseStatus,
    note?: string
  ) => Promise<void> | void;
  onSimulateEscalate?: (occurrenceId: string) => void;
  simplifiedElderMode?: boolean;
}

export function DoseCard({
  occurrence,
  activeRole,
  currentActorName,
  onCheckIn,
  onSimulateEscalate,
  simplifiedElderMode = false,
}: DoseCardProps) {
  const [loading, setLoading] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [skipNote, setSkipNote] = useState("");

  const handleAction = async (status: DoseStatus, note?: string) => {
    setLoading(true);
    try {
      await onCheckIn(occurrence.id, status, note);
    } finally {
      setLoading(false);
      setShowNoteInput(false);
    }
  };

  const speakDose = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const msg = `Scheduled for ${occurrence.scheduledTime}. ${occurrence.medicationName}, ${occurrence.doseText}. Instructions: ${occurrence.instructions}.`;
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getStatusBadge = (status: DoseStatus) => {
    switch (status) {
      case "MARKED_TAKEN":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Marked Taken</span>
          </span>
        );
      case "SNOOZED":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            <span>Remind Me Later</span>
          </span>
        );
      case "SKIPPED":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
            <span>Skipped</span>
          </span>
        );
      case "NEEDS_HELP":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Needs Assistance</span>
          </span>
        );
      case "UNCONFIRMED":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>Unconfirmed (Escalated)</span>
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Due Now</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            <span>Scheduled</span>
          </span>
        );
    }
  };

  // Color pill helper
  const pillColorClasses: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 p-5 ${
        occurrence.status === "MARKED_TAKEN"
          ? "border-emerald-200 bg-[#f9fcfa]"
          : occurrence.status === "UNCONFIRMED"
          ? "border-rose-300 bg-rose-50/20 shadow-sm"
          : "border-gray-200 shadow-sm hover:border-[#4a7c68]"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: Time + Pill icon + Name + Instructions */}
        <div className="flex items-start space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
              pillColorClasses[occurrence.pillColor] || "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            <Pill className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                {occurrence.scheduledTime}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {occurrence.pillShape}
              </span>
              <button
                onClick={speakDose}
                className="text-gray-400 hover:text-emerald-700 p-1 rounded-full transition-colors"
                title="Read prescription aloud"
                aria-label={`Read aloud details for ${occurrence.medicationName}`}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mt-1">
              {occurrence.medicationName}{" "}
              <span className="text-sm font-medium text-gray-600">({occurrence.doseText})</span>
            </h3>

            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 max-w-xl">
              {occurrence.instructions}
            </p>

            {/* Check-in audit note if recorded */}
            {occurrence.checkIn && (
              <div className="mt-2 text-xs text-gray-500 flex items-center space-x-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                <Info className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  Recorded by <strong>{occurrence.checkIn.actorName}</strong> at {occurrence.checkIn.recordedAt}
                  {occurrence.checkIn.note ? ` • "${occurrence.checkIn.note}"` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Status badge */}
        <div className="shrink-0 self-start sm:self-center">
          {getStatusBadge(occurrence.status)}
        </div>
      </div>

      {/* Primary Action Buttons (WCAG AA/AAA Senior Friendly Size > 48px) */}
      {occurrence.status !== "MARKED_TAKEN" && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-500 mb-2">
            Confirm care action:
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Mark Taken Button */}
            <button
              disabled={loading}
              onClick={() => handleAction("MARKED_TAKEN")}
              className="min-h-[48px] bg-[#2d4a3e] hover:bg-[#385c4c] text-white font-semibold text-sm rounded-xl px-4 py-2.5 flex items-center justify-center space-x-2 shadow-sm transition-all focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Marked taken</span>
            </button>

            {/* Remind Me Later (Snooze) Button */}
            <button
              disabled={loading}
              onClick={() => handleAction("SNOOZED")}
              className="min-h-[48px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-sm rounded-xl px-4 py-2.5 flex items-center justify-center space-x-2 transition-all focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
            >
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Remind me later</span>
            </button>

            {/* I Need Help Button (Bypasses grace period, immediately creates high-priority caregiver alert) */}
            <button
              disabled={loading}
              onClick={() => handleAction("NEEDS_HELP", "Elder requested direct assistance")}
              className="min-h-[48px] bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 font-semibold text-sm rounded-xl px-4 py-2.5 flex items-center justify-center space-x-2 transition-all focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
            >
              <HelpCircle className="w-4 h-4 text-rose-700" />
              <span>I need help</span>
            </button>

            {/* Skipped Button */}
            <button
              disabled={loading}
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="min-h-[48px] bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 font-medium text-sm rounded-xl px-4 py-2.5 flex items-center justify-center space-x-1.5 transition-all focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
            >
              <span>Skipped</span>
            </button>
          </div>

          {/* Optional reason field when skipping */}
          {showNoteInput && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Optional reason for skipping (e.g. upset stomach, fasting, doctor advised):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skipNote}
                  onChange={(e) => setSkipNote(e.target.value)}
                  placeholder="Enter reason..."
                  className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => handleAction("SKIPPED", skipNote)}
                  className="bg-gray-800 text-white text-xs px-3 py-2 rounded-lg font-medium hover:bg-black transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* CareLoop Live Demo Trigger pill */}
          {onSimulateEscalate && occurrence.status !== "UNCONFIRMED" && (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={() => onSimulateEscalate(occurrence.id)}
                className="text-[11px] text-gray-400 hover:text-amber-800 hover:underline inline-flex items-center space-x-1"
                title="Demonstrates CareLoop escalation if elder does not respond within grace period"
              >
                <span>[Demo Test: Simulate missed check-in escalation]</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
