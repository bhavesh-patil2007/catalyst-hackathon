"use client";

import React from "react";
import {
  X,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { DailyCareBrief } from "@/types";

interface DailyCareBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: DailyCareBrief | null;
}

export function DailyCareBriefModal({
  isOpen,
  onClose,
  brief,
}: DailyCareBriefModalProps) {
  if (!isOpen || !brief) return null;

  const speakBrief = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(brief.summaryText);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="bg-[#2d4a3e] p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3d6554] flex items-center justify-center text-amber-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg">Daily Care Brief</h3>
              <p className="text-xs text-emerald-200">
                Ground-truth factual summary for {brief.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-[#385b4c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Audio narration button */}
          <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-100">
            <div className="flex items-center space-x-2 text-xs text-emerald-900 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Grounded in verified application records • No clinical inference</span>
            </div>
            <button
              onClick={speakBrief}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-emerald-700 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-800 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen</span>
            </button>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="text-xl font-bold text-emerald-700">{brief.takenCount} / {brief.totalScheduled}</div>
              <div className="text-[11px] text-gray-500 font-medium mt-0.5">Meds Taken</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="text-xl font-bold text-amber-600">{brief.unconfirmedCount}</div>
              <div className="text-[11px] text-gray-500 font-medium mt-0.5">Pending/Missed</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="text-xl font-bold text-rose-600">{brief.openTasksCount}</div>
              <div className="text-[11px] text-gray-500 font-medium mt-0.5">Care Tasks</div>
            </div>
          </div>

          {/* Main Brief Text Box */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Auditable Timeline Digest:
            </div>
            <div className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-line font-mono bg-white p-3 rounded-lg border border-gray-100">
              {brief.summaryText}
            </div>
          </div>

          {/* Footer note */}
          <div className="text-[11px] text-gray-400 text-center">
            Generated at {brief.generatedAt}. Source: CareOrbit Database Records.
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#2d4a3e] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#385b4c] transition-colors"
          >
            Close Brief
          </button>
        </div>
      </div>
    </div>
  );
}
