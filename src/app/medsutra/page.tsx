"use client";

import React, { useState, useRef, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Sparkles,
  Upload,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileImage,
  Volume2,
  VolumeX,
  ShieldAlert,
  ArrowRight,
  Clock,
  Pill,
  Languages,
} from "lucide-react";

interface Extraction {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  confidence: "high" | "medium" | "low";
  uncertain_fields: string[];
  plain_language_explanation: string;
  plain_language_hi?: string;
  plain_language_mr?: string;
  handwriting_alert?: string;
}

interface DraftSchedule {
  slot: "morning" | "afternoon" | "evening" | "bedtime";
  scheduleTime: string;
}

type CardState = "pending" | "added" | "rejected";

interface ExtractionCard {
  extraction: Extraction;
  state: CardState;
  draft: DraftSchedule;
}

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
  { code: "mr", label: "मराठी", flag: "🇮🇳" },
];

export default function MedSutraPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi" | "mr">("en");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<ExtractionCard[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleFile = (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10MB.");
      return;
    }
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      setError("Only image files or PDFs are accepted.");
      return;
    }
    setError(null);
    setFile(f);
    setCards([]);
    setSource(null);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setCards([]);
    setSource(null);

    try {
      const formData = new FormData();
      formData.append("prescription", file);

      const res = await fetch("/api/medsutra/extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Extraction failed. Please try again.");
        return;
      }

      setSource(data.source);
      setCards(
        (data.extractions as Extraction[]).map((e) => ({
          extraction: e,
          state: "pending" as CardState,
          draft: {
            slot: e.frequency.toLowerCase().includes("night") || e.frequency.toLowerCase().includes("bed")
              ? "bedtime"
              : e.frequency.toLowerCase().includes("afternoon")
              ? "afternoon"
              : e.frequency.toLowerCase().includes("evening")
              ? "evening"
              : "morning",
            scheduleTime: e.frequency.toLowerCase().includes("night")
              ? "08:30 PM"
              : e.frequency.toLowerCase().includes("afternoon")
              ? "01:00 PM"
              : e.frequency.toLowerCase().includes("evening")
              ? "06:00 PM"
              : "08:00 AM",
          },
        }))
      );
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceReadout = (card: ExtractionCard, idx: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast("Speech synthesis is not supported on this browser.");
      return;
    }

    if (speakingIndex === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    let textToSpeak = `${card.extraction.name}, dosage ${card.extraction.dosage}. Take ${card.extraction.frequency}. ${card.extraction.plain_language_explanation}`;
    let voiceLang = "en-US";

    if (selectedLanguage === "hi" && card.extraction.plain_language_hi) {
      textToSpeak = `${card.extraction.name}, मात्रा ${card.extraction.dosage}. ${card.extraction.plain_language_hi}`;
      voiceLang = "hi-IN";
    } else if (selectedLanguage === "mr" && card.extraction.plain_language_mr) {
      textToSpeak = `${card.extraction.name}, प्रमाण ${card.extraction.dosage}. ${card.extraction.plain_language_mr}`;
      voiceLang = "mr-IN";
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = voiceLang;
    utterance.rate = 0.9;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(idx);
    window.speechSynthesis.speak(utterance);
  };

  const handleVerifyAdd = async (idx: number) => {
    const card = cards[idx];
    if (!card) return;
    const { extraction, draft } = card;

    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: extraction.name,
          dosage: extraction.dosage,
          instructions: extraction.instructions || extraction.frequency,
          slot: draft.slot,
          scheduleTime: draft.scheduleTime,
          remainingQuantity: 30,
          dailyFrequency: 1,
          refillThreshold: 7,
          reason: `Prescription extraction verified and approved via MedSutra AI`,
        }),
      });
      const data = await res.json();
      if (data.success !== false) {
        setCards((prev) =>
          prev.map((c, i) => (i === idx ? { ...c, state: "added" } : c))
        );
        showToast(`✓ ${extraction.name} verified and added to active schedule`);
      } else {
        setError(data.error || "Failed to add medication.");
      }
    } catch {
      setError("Failed to add medication. Please try again.");
    }
  };

  const handleReject = (idx: number) => {
    setCards((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, state: "rejected" } : c))
    );
  };

  const getExplanation = (ext: Extraction) => {
    if (selectedLanguage === "hi" && ext.plain_language_hi) return ext.plain_language_hi;
    if (selectedLanguage === "mr" && ext.plain_language_mr) return ext.plain_language_mr;
    return ext.plain_language_explanation;
  };

  const confidenceConfig = {
    high: { label: "High Confidence", bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" },
    medium: { label: "Medium Confidence", bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
    low: { label: "Low Confidence", bg: "bg-rose-100", text: "text-rose-800", dot: "bg-rose-500" },
  };

  return (
    <div className="min-h-screen bg-[#f6f9f7] pb-16">
      <Navbar activeRole="family_manager" onRoleChange={() => {}} />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2d4a3e] text-white px-5 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span>{toast}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header Banner */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold text-emerald-800 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Google Gemini Flash Vision Powered</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 tracking-tight">
              MedSutra AI — Prescription Intelligence
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-600 max-w-xl leading-relaxed">
              Upload prescription photographs or PDFs. MedSutra extracts dosage, frequency, and instructions with clinical confidence scores and multilingual voice narration.
            </p>
          </div>

          {/* Language Selector */}
          <div className="flex flex-col sm:items-end">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Languages className="w-3.5 h-3.5 text-emerald-700" />
              <span>Explanation Language</span>
            </span>
            <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedLanguage === lang.code
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <span className="mr-1">{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 mb-8 shadow-xs">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-emerald-600 bg-emerald-50/50 scale-[0.99]"
                : file
                ? "border-emerald-400 bg-emerald-50/20"
                : "border-gray-300 hover:border-emerald-500 hover:bg-gray-50/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={onInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm sm:text-base font-bold text-gray-900">
                {file ? file.name : "Drag & drop prescription image or PDF here"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB &bull; Click to select a different file`
                  : "Supports JPEG, PNG, WebP photos or clinic discharge PDFs up to 10MB"}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="text-[11px] text-gray-400">
              ⚡ Prescriptions are processed in memory and never shared with unauthorized parties.
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className="w-full sm:w-auto bg-[#2d4a3e] hover:bg-[#385b4c] text-white px-6 py-3 rounded-xl font-semibold text-xs transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                  <span>Extracting with Gemini Flash...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>Extract Prescription Intelligence</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Extraction Results */}
        {cards.length > 0 && (
          <div className="space-y-6">
            {source === "demo" && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Demonstration Template Notice:</strong> Live Google Gemini API is not configured. The extractions below are pre-packaged clinical demonstration templates and were <em>not</em> extracted from your uploaded file.
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="font-serif text-lg font-bold text-gray-900">
                  Extracted Medication Drafts ({cards.length})
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full">
                  Source: {source === "gemini" ? "Google Gemini Vision" : "MedSutra Verified Demo"}
                </span>
              </div>

              <div className="text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 inline-flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                <span>Human Verification Required Before Schedule Activation</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {cards.map((card, idx) => {
                const { extraction, state, draft } = card;
                const conf = confidenceConfig[extraction.confidence];
                const hasHandwritingAlert =
                  Boolean(extraction.handwriting_alert) || extraction.uncertain_fields.length > 0;

                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-3xl border-2 p-6 transition-all ${
                      state === "added"
                        ? "border-emerald-500 bg-emerald-50/20 opacity-80"
                        : state === "rejected"
                        ? "border-gray-200 bg-gray-50 opacity-40 line-through"
                        : "border-gray-200 shadow-sm hover:border-[#3d6554]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                          <Pill className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{extraction.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-md">
                              {extraction.dosage}
                            </span>
                            <span className="text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
                              {extraction.frequency}
                            </span>
                            <span className="text-xs text-gray-500">
                              Duration: <strong>{extraction.duration}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Confidence Pill */}
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center space-x-1.5 ${conf.bg} ${conf.text}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                          <span>{conf.label}</span>
                        </span>

                        {/* Voice Readout Button */}
                        <button
                          type="button"
                          onClick={() => handleVoiceReadout(card, idx)}
                          className={`p-2 rounded-xl border text-xs font-semibold transition-colors flex items-center space-x-1 ${
                            speakingIndex === idx
                              ? "bg-emerald-700 text-white border-emerald-700"
                              : "bg-gray-50 hover:bg-emerald-50 text-emerald-800 border-gray-200"
                          }`}
                          title="Voice Readout in Selected Language"
                        >
                          {speakingIndex === idx ? (
                            <VolumeX className="w-4 h-4 text-white" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-emerald-700" />
                          )}
                          <span className="hidden sm:inline">Voice</span>
                        </button>
                      </div>
                    </div>

                    {/* Handwriting Warning */}
                    {hasHandwritingAlert && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Handwriting Clarification Alert:</strong>{" "}
                          {extraction.handwriting_alert ||
                            `Fields with potential ambiguity: ${extraction.uncertain_fields.join(", ")}. Please review physically before confirming.`}
                        </div>
                      </div>
                    )}

                    {/* Plain Language Explanation */}
                    <div className="mt-4 bg-[#fbfdfc] border border-emerald-100 rounded-2xl p-4">
                      <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider mb-1 flex items-center space-x-1">
                        <span>💡 Patient-Friendly Explanation ({selectedLanguage.toUpperCase()})</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-sans">
                        {getExplanation(extraction)}
                      </p>
                    </div>

                    {/* Schedule Draft Parameters */}
                    {state === "pending" && (
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Schedule Slot
                          </label>
                          <select
                            value={draft.slot}
                            onChange={(e) => {
                              const newSlot = e.target.value as any;
                              setCards((prev) =>
                                prev.map((c, i) =>
                                  i === idx
                                    ? {
                                        ...c,
                                        draft: {
                                          ...c.draft,
                                          slot: newSlot,
                                          scheduleTime:
                                            newSlot === "morning"
                                              ? "08:00 AM"
                                              : newSlot === "afternoon"
                                              ? "01:00 PM"
                                              : newSlot === "evening"
                                              ? "06:00 PM"
                                              : "08:30 PM",
                                        },
                                      }
                                    : c
                                )
                              );
                            }}
                            className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white text-gray-900"
                          >
                            <option value="morning">Morning (8:00 AM)</option>
                            <option value="afternoon">Afternoon (1:00 PM)</option>
                            <option value="evening">Evening (6:00 PM)</option>
                            <option value="bedtime">Bedtime (8:30 PM)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Scheduled Routine Time
                          </label>
                          <input
                            type="text"
                            value={draft.scheduleTime}
                            onChange={(e) => {
                              const newTime = e.target.value;
                              setCards((prev) =>
                                prev.map((c, i) =>
                                  i === idx ? { ...c, draft: { ...c.draft, scheduleTime: newTime } } : c
                                )
                              );
                            }}
                            className="w-full text-xs border border-gray-300 rounded-xl p-2 bg-white text-gray-900"
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-[11px] text-gray-400">
                        Instructions: {extraction.instructions}
                      </div>

                      {state === "pending" ? (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleReject(idx)}
                            className="text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyAdd(idx)}
                            className="bg-[#2d4a3e] hover:bg-[#395c4e] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Verify &amp; Add to Schedule</span>
                          </button>
                        </div>
                      ) : state === "added" ? (
                        <span className="text-xs font-bold text-emerald-700 inline-flex items-center space-x-1">
                          <CheckCircle className="w-4 h-4" />
                          <span>Approved &bull; Active Schedule Created</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Rejected</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
