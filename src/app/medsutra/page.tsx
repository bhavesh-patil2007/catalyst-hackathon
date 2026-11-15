"use client";

import React, { useState, useRef, useCallback } from "react";
import { Sparkles, Upload, X, CheckCircle, AlertTriangle, Loader2, FileImage } from "lucide-react";

interface Extraction {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  confidence: "high" | "medium" | "low";
  uncertain_fields: string[];
}

type CardState = "pending" | "added" | "rejected";

interface ExtractionCard {
  extraction: Extraction;
  state: CardState;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "mr", label: "मराठी" },
];

export default function MedSutraPage() {
  const [language, setLanguage] = useState("en");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<ExtractionCard[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
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
        }))
      );
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAdd = async (idx: number) => {
    const card = cards[idx];
    if (!card) return;
    const { extraction } = card;

    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: extraction.name,
          dosage: extraction.dosage,
          instructions: extraction.instructions || extraction.frequency,
          slot: "morning",
          scheduleTime: "08:00 AM",
          remainingQuantity: 30,
          dailyFrequency: 1,
          refillThreshold: 7,
          actorRole: "family_manager",
        }),
      });
      const data = await res.json();
      if (data.success !== false) {
        setCards((prev) =>
          prev.map((c, i) => (i === idx ? { ...c, state: "added" } : c))
        );
        showToast(`✓ ${extraction.name} added to medication schedule`);
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

  const confidenceConfig = {
    high: { label: "High Confidence", bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" },
    medium: { label: "Medium Confidence", bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
    low: { label: "Low Confidence", bg: "bg-rose-100", text: "text-rose-800", dot: "bg-rose-500" },
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasResults = cards.length > 0;
  const activeCards = cards.filter((c) => c.state !== "rejected");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f7f4] to-[#e8f5ee]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-in slide-in-from-right">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2d4a3e] text-emerald-200 shadow-lg mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#2d4a3e] mb-2">
            MedSutra AI
          </h1>
          <p className="text-lg text-emerald-700 font-medium mb-3">
            Prescription Intelligence
          </p>
          <span className="inline-flex items-center space-x-1.5 bg-[#2d4a3e] text-emerald-200 text-sm px-4 py-1.5 rounded-full font-medium shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Powered by Google Gemini Flash</span>
          </span>
        </div>

        {/* Language Selector */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white rounded-xl border border-emerald-200 p-1 shadow-sm">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  language === lang.code
                    ? "bg-[#2d4a3e] text-white shadow-sm"
                    : "text-emerald-800 hover:bg-emerald-50"
                }`}
                aria-pressed={language === lang.code}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-serif font-bold text-[#2d4a3e] mb-4 flex items-center space-x-2">
            <FileImage className="w-5 h-5 text-emerald-600" />
            <span>Upload Prescription</span>
          </h2>

          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-emerald-500 bg-emerald-50"
                : "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50"
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload prescription file"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={onInputChange}
              aria-hidden="true"
            />
            <Upload
              className={`w-12 h-12 mx-auto mb-3 transition-colors ${
                isDragging ? "text-emerald-600" : "text-emerald-300"
              }`}
            />
            <p className="text-lg font-semibold text-[#2d4a3e] mb-1">
              Drag & drop your prescription here
            </p>
            <p className="text-sm text-gray-500">
              or click to browse • Images or PDF • Max 10MB
            </p>
          </div>

          {/* File chip */}
          {file && (
            <div className="mt-4 inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-full text-sm font-medium">
              <FileImage className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="max-w-xs truncate">{file.name}</span>
              <span className="text-emerald-500">({formatFileSize(file.size)})</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setCards([]);
                  setSource(null);
                  setError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="ml-1 text-emerald-600 hover:text-rose-600 transition-colors"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start space-x-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className={`mt-5 w-full py-3.5 px-6 rounded-xl font-semibold text-base transition-all flex items-center justify-center space-x-2 ${
              !file || loading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-[#2d4a3e] hover:bg-[#1f352a] text-white shadow-md hover:shadow-lg"
            }`}
            aria-disabled={!file || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyzing Prescription…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Analyze Prescription</span>
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {hasResults && (
          <div>
            {/* Verification Banner */}
            <div className="flex items-start space-x-3 bg-amber-50 border border-amber-300 text-amber-900 px-5 py-4 rounded-xl mb-6 shadow-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold text-base">⚠️ Human Verification Required</p>
                <p className="text-sm mt-0.5">
                  Review all fields carefully before adding to schedule.{" "}
                  {source === "demo" && (
                    <span className="font-medium text-amber-700">(Demo mode — no API key configured)</span>
                  )}
                </p>
              </div>
            </div>

            {/* Extraction Cards */}
            <div className="space-y-4">
              {cards.map((card, idx) => {
                if (card.state === "rejected") return null;

                const { extraction } = card;
                const conf = confidenceConfig[extraction.confidence];

                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-2xl border shadow-sm p-6 transition-all ${
                      card.state === "added"
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-gray-200 hover:border-emerald-200"
                    }`}
                  >
                    {/* Medicine header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold font-serif text-[#2d4a3e]">
                          {extraction.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">{extraction.instructions}</p>
                      </div>
                      {/* Confidence badge */}
                      <span
                        className={`inline-flex items-center space-x-1.5 ${conf.bg} ${conf.text} text-xs font-semibold px-3 py-1 rounded-full shrink-0 ml-3`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                        <span>{conf.label}</span>
                      </span>
                    </div>

                    {/* Detail pills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="bg-[#2d4a3e]/10 text-[#2d4a3e] text-sm font-semibold px-3 py-1.5 rounded-full">
                        💊 {extraction.dosage}
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 text-sm font-medium px-3 py-1.5 rounded-full border border-emerald-100">
                        🕐 {extraction.frequency}
                      </span>
                      <span className="bg-sky-50 text-sky-800 text-sm font-medium px-3 py-1.5 rounded-full border border-sky-100">
                        📅 {extraction.duration}
                      </span>
                    </div>

                    {/* Uncertain fields warning */}
                    {extraction.uncertain_fields.length > 0 && (
                      <div className="flex items-center space-x-2 mb-4 flex-wrap gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs text-amber-700 font-medium">Uncertain:</span>
                        {extraction.uncertain_fields.map((f) => (
                          <span
                            key={f}
                            className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {card.state === "pending" && (
                      <div className="flex items-center space-x-3 mt-2">
                        <button
                          onClick={() => handleVerifyAdd(idx)}
                          className="flex-1 bg-[#2d4a3e] hover:bg-[#1f352a] text-white py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center space-x-2 shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>✓ Verify & Add to Schedule</span>
                        </button>
                        <button
                          onClick={() => handleReject(idx)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center space-x-2"
                        >
                          <X className="w-4 h-4" />
                          <span>✗ Reject</span>
                        </button>
                      </div>
                    )}

                    {card.state === "added" && (
                      <div className="flex items-center space-x-2 mt-2 text-emerald-700 font-semibold text-sm">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span>Added ✓ — Medication scheduled successfully</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {activeCards.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="font-medium">All extractions reviewed.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Safety Disclaimer */}
        <p className="mt-10 text-center text-sm italic text-gray-400 leading-relaxed">
          MedSutra AI assists with prescription reading — it does not replace a licensed pharmacist or physician.
          Always verify extracted information with the original prescription and consult your healthcare provider
          before making any changes to medication schedules.
        </p>
      </div>
    </div>
  );
}
