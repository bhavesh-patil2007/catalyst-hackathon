"use client";

import React, { FormEvent, useState, Suspense } from "react";
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

const DEMO_FAMILY_CODE = "OASIS-7629";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");

  const [activeTab, setActiveTab] = useState<"circle" | "elder">("circle");

  // Family / Circle code state (defaults to DEMO_FAMILY_CODE to preserve PR #2 demo login)
  const [code, setCode] = useState(DEMO_FAMILY_CODE);
  const [memberName, setMemberName] = useState("Sarah Thompson");
  const [circleLoading, setCircleLoading] = useState(false);
  const [circleError, setCircleError] = useState("");

  // Older Adult PIN state
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  async function handleCircleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCircleLoading(true);
    setCircleError("");

    try {
      const response = await fetch("/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: memberName.trim() || undefined,
          redirect: redirectTarget || undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setCircleError(result.error || "Unable to sign in. Check the invitation code.");
        return;
      }

      const dest = result.redirectUrl || "/dashboard";
      router.replace(dest);
      router.refresh();
    } catch {
      setCircleError("Connection error. Please try again.");
    } finally {
      setCircleLoading(false);
    }
  }

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
          body: JSON.stringify({ pin: fullPin, redirect: redirectTarget || undefined }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          router.replace(data.redirectUrl || "/elder");
          router.refresh();
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

  return (
    <section className="w-full max-w-md bg-white rounded-3xl border border-emerald-100 shadow-xl overflow-hidden">
      {/* Header Banner */}
      <div className="bg-[#2d4a3e] text-white px-7 py-8 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
          <HeartHandshake className="w-7 h-7 text-emerald-200" />
        </div>
        <p className="text-xs uppercase tracking-widest text-emerald-200">PromptWars &times; Catalyst</p>
        <h1 className="mt-2 text-2xl font-bold font-serif">Welcome to Guardian Oasis</h1>
        <p className="mt-2 text-sm text-emerald-100">
          Enter Eleanor&apos;s connected care circle or senior portal
        </p>

        {/* Tab Switcher */}
        <div className="mt-5 flex bg-[#162720]/80 p-1.5 rounded-2xl border border-emerald-700/50">
          <button
            type="button"
            onClick={() => setActiveTab("circle")}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "circle"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-emerald-200 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Family & Care Circle</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("elder")}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "elder"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-emerald-200 hover:text-white"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Older Adult (PIN)</span>
          </button>
        </div>
      </div>

      <div className="p-7">
        {/* TAB 1: CIRCLE / FAMILY LOGIN */}
        {activeTab === "circle" && (
          <form onSubmit={handleCircleSubmit} className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <strong>Demo access &amp; evaluation</strong>
                <p className="mt-1">
                  This evaluation uses synthetic sample data for Eleanor Thompson and her care circle.
                  Do not enter real patient information.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="invite-code" className="block text-sm font-semibold text-gray-800 mb-2">
                Invitation / Circle Passcode
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="invite-code"
                  name="code"
                  autoComplete="off"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="e.g. OASIS-7629"
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-3 py-3 font-mono tracking-wider text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Demo code: <code className="font-semibold text-emerald-800">OASIS-7629</code> (Family Manager) or <code className="font-semibold text-emerald-800">CAREGIVER-4192</code>
              </p>
            </div>

            <div>
              <label htmlFor="member-name" className="block text-sm font-semibold text-gray-800 mb-2">
                Your Name
              </label>
              <input
                id="member-name"
                name="name"
                autoComplete="name"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                placeholder="e.g. Sarah Thompson"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {circleError && (
              <div role="alert" className="flex gap-2 items-start rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{circleError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={circleLoading || !code.trim()}
              className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold py-3.5 flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {circleLoading ? "Signing in..." : "Enter Family Dashboard"}
              {!circleLoading && <ArrowRight className="w-4 h-4" />}
            </button>

            <Link href="/" className="block text-center text-sm text-emerald-800 hover:underline">
              Back to home
            </Link>
          </form>
        )}

        {/* TAB 2: ELDER PIN ACCESS */}
        {activeTab === "elder" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-base font-bold text-gray-900 font-serif">
                Enter Your 4-Digit Passcode
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Senior-friendly high contrast keypad for Eleanor
              </p>
            </div>

            {/* PIN Visual Indicators */}
            <div className="flex justify-center space-x-3 my-2">
              {pinDigits.map((digit, index) => (
                <div
                  key={index}
                  className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold font-mono transition-all ${
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
              <div role="alert" className="flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handlePinDigitClick(n)}
                  className="h-12 rounded-2xl bg-gray-50 hover:bg-emerald-50 active:bg-emerald-100 text-gray-800 hover:text-emerald-900 text-lg font-bold font-mono border border-gray-200 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                type="button"
                disabled={pinLoading}
                onClick={() => handlePinDigitClick("0")}
                className="h-12 rounded-2xl bg-gray-50 hover:bg-emerald-50 active:bg-emerald-100 text-gray-800 hover:text-emerald-900 text-lg font-bold font-mono border border-gray-200 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                0
              </button>
              <button
                type="button"
                disabled={pinLoading}
                onClick={handlePinClear}
                className="h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold uppercase tracking-wider border border-rose-200 transition-all shadow-sm"
              >
                Clear
              </button>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-center text-xs text-emerald-800">
              <span className="font-semibold">Demo Evaluation:</span> Eleanor&apos;s PIN is{" "}
              <code className="bg-white px-2 py-0.5 rounded font-mono font-bold">1234</code>
            </div>

            <Link href="/" className="block text-center text-sm text-emerald-800 hover:underline">
              Back to home
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f6f9f7] flex items-center justify-center px-4 py-10">
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
  );
}
