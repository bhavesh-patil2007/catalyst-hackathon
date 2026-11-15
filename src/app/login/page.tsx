"use client";

import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Lock, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";

const DEMO_FAMILY_CODE = "OASIS-7629";

function safeDashboardRedirect(): string {
  if (typeof window === "undefined") return "/dashboard";
  const requested = new URLSearchParams(window.location.search).get("redirect");
  // This demo login only authenticates as family_manager. Never accept an external
  // URL or redirect a family-manager session into another role's portal.
  return requested === "/dashboard" || requested?.startsWith("/dashboard/")
    ? requested
    : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState(DEMO_FAMILY_CODE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: "Sarah Thompson" }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || "Unable to sign in. Check the invitation code.");
        return;
      }

      router.replace(safeDashboardRedirect());
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f9f7] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white rounded-3xl border border-emerald-100 shadow-lg overflow-hidden">
        <div className="bg-[#2d4a3e] text-white px-7 py-8 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <HeartHandshake className="w-7 h-7 text-emerald-200" />
          </div>
          <p className="text-xs uppercase tracking-widest text-emerald-200">PromptWars × Catalyst</p>
          <h1 className="mt-2 text-2xl font-bold">Welcome to Guardian Oasis</h1>
          <p className="mt-2 text-sm text-emerald-100">Enter the CareOrbit family demo dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
            <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong>Demo access</strong>
              <p className="mt-1">This evaluation uses fictional sample data for Eleanor Thompson and her care circle. Do not enter real patient information.</p>
            </div>
          </div>

          <div>
            <label htmlFor="invite-code" className="block text-sm font-semibold text-gray-800 mb-2">
              Family Manager Invitation Code
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
                className="w-full rounded-xl border border-gray-300 pl-10 pr-3 py-3 font-mono tracking-wider text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">Demo code: <code className="font-semibold">OASIS-7629</code></p>
          </div>

          {error && (
            <div role="alert" className="flex gap-2 items-start rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold py-3.5 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? "Signing in..." : "Enter Family Dashboard"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <a href="/" className="block text-center text-sm text-emerald-800 hover:underline">
            Back to home
          </a>
        </form>
      </section>
    </main>
  );
}
