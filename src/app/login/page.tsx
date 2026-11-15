"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  HeartHandshake,
  ShieldCheck,
  Lock,
  Users,
  AlertCircle,
  KeyRound,
  ArrowRight,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");

  const [activeTab, setActiveTab] = useState<"elder" | "circle">("elder");

  // Elder PIN state
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Circle Invite state
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [circleError, setCircleError] = useState<string | null>(null);
  const [circleLoading, setCircleLoading] = useState(false);

  const handlePinDigitClick = async (digit: string) => {
    setPinError(null);
    const nextEmptyIndex = pinDigits.findIndex((d) => d === "");
    if (nextEmptyIndex === -1) return;

    const updated = [...pinDigits];
    updated[nextEmptyIndex] = digit;
    setPinDigits(updated);

    if (nextEmptyIndex === 3) {
      // 4th digit entered: submit PIN
      const fullPin = updated.join("");
      setPinLoading(true);
      try {
        const res = await fetch("/api/auth/elder-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: fullPin, redirect: redirectTarget }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          router.push(data.redirectUrl || "/elder");
        } else {
          setPinError(data.error || "Incorrect 4-digit PIN.");
          setPinDigits(["", "", "", ""]);
        }
      } catch {
        setPinError("Connection error. Please try again.");
        setPinDigits(["", "", "", ""]);
      } finally {
        setPinLoading(false);
      }
    }
  };

  const handlePinClear = () => {
    setPinDigits(["", "", "", ""]);
    setPinError(null);
  };

  const handleCircleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setCircleError("Please enter your invitation code.");
      return;
    }

    setCircleLoading(true);
    setCircleError(null);
    try {
      const res = await fetch("/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inviteCode.trim(),
          redirect: redirectTarget,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(data.redirectUrl || "/dashboard");
      } else {
        setCircleError(data.error || "Invalid invitation code. Check and try again.");
      }
    } catch {
      setCircleError("Connection error. Please try again.");
    } finally {
      setCircleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#2d4a3e] to-[#1f352c] text-white p-6 sm:p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-3 shadow-inner">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
          Welcome to CareOrbit
        </h1>
        <p className="text-sm text-emerald-100/90 mt-1">
          Select your access method to enter Eleanor&apos;s connected care circle
        </p>

        {/* Tab Switcher */}
        <div className="mt-6 flex bg-[#162720]/80 p-1.5 rounded-2xl border border-emerald-700/50">
          <button
            type="button"
            onClick={() => setActiveTab("elder")}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "elder"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-emerald-200 hover:text-white"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Older Adult (PIN)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("circle")}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "circle"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-emerald-200 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Care Circle (Code)</span>
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 sm:p-8">
        {/* TAB 1: ELDER PIN ACCESS */}
        {activeTab === "elder" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900 font-serif">
                Enter Your 4-Digit Passcode
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Designed for ease of use with high-contrast, large touch targets
              </p>
            </div>

            {/* PIN Visual Indicators */}
            <div className="flex justify-center space-x-4 my-4">
              {pinDigits.map((digit, index) => (
                <div
                  key={index}
                  className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold font-mono transition-all ${
                    digit
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm"
                      : "border-gray-200 bg-gray-50 text-gray-400"
                  }`}
                >
                  {digit ? "●" : ""}
                </div>
              ))}
            </div>

            {pinError && (
              <div className="flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handlePinDigitClick(n)}
                  className="h-14 rounded-2xl bg-gray-50 hover:bg-emerald-50 active:bg-emerald-100 text-gray-800 hover:text-emerald-900 text-xl font-bold font-mono border border-gray-200 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                type="button"
                disabled={pinLoading}
                onClick={() => handlePinDigitClick("0")}
                className="h-14 rounded-2xl bg-gray-50 hover:bg-emerald-50 active:bg-emerald-100 text-gray-800 hover:text-emerald-900 text-xl font-bold font-mono border border-gray-200 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                0
              </button>
              <button
                type="button"
                disabled={pinLoading}
                onClick={handlePinClear}
                className="h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold uppercase tracking-wider border border-rose-200 transition-all shadow-sm"
              >
                Clear
              </button>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-center text-xs text-emerald-800">
              <span className="font-semibold">Demo Evaluation Note:</span> Default PIN is{" "}
              <code className="bg-white px-2 py-0.5 rounded font-mono font-bold">1234</code>
            </div>
          </div>
        )}

        {/* TAB 2: CARE CIRCLE INVITATION CODE */}
        {activeTab === "circle" && (
          <form onSubmit={handleCircleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Invitation Passcode
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g., OASIS-7629"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 font-mono text-base uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Your invitation code automatically verifies and assigns your role on the server.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g., Sarah Thompson"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {circleError && (
              <div className="flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{circleError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={circleLoading}
              className="w-full bg-[#2d4a3e] hover:bg-[#243c32] active:bg-[#1a2c24] text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
            >
              {circleLoading ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <span>Enter Care Circle</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f4f8f6] text-[#1c2e27] flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-[#2d4a3e] text-white py-4 px-6 border-b border-[#22392f] shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#3d6554] border border-[#558d73] flex items-center justify-center text-emerald-200">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-tight">Guardian Oasis</span>
              <span className="ml-2 text-xs bg-[#1f352c] text-emerald-300 px-2 py-0.5 rounded-full border border-[#355b4a]">
                Passcode Gate
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="text-xs text-emerald-200 hover:text-white underline underline-offset-4"
          >
            &larr; Back to Overview
          </Link>
        </div>
      </header>

      {/* Main Login Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Suspense
          fallback={
            <div className="text-center text-gray-500 py-12">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading login portal...</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-500">
        Guardian Oasis &bull; PromptWars &times; Catalyst Hackathon &bull; Secure Care Ecosystem
      </footer>
    </div>
  );
}
