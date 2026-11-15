"use client";

import React, { useState } from "react";
import { Lock, AlertCircle, KeyRound, Users, ArrowRight } from "lucide-react";
import { UserRole } from "@/types";
import { useRouter } from "next/navigation";

interface PasscodeGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
  elderPin?: string;
  circleInviteCode?: string;
}

export function PasscodeGateModal({
  isOpen,
  onClose,
  onSuccess,
}: PasscodeGateModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"elder" | "circle">("elder");
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [inviteInput, setInviteInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDigitChange = async (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const updated = [...pinDigits];
    updated[index] = value;
    setPinDigits(updated);
    setErrorMsg(null);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-digit-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit on 4th digit
    if (index === 3 && value) {
      const fullPin = updated.join("");
      setLoading(true);
      try {
        const res = await fetch("/api/auth/elder-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: fullPin }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onSuccess("owner");
          router.push(data.redirectUrl || "/elder");
          onClose();
        } else {
          setErrorMsg(data.error ?? "Incorrect 4-digit PIN. Try '1234'");
          setPinDigits(["", "", "", ""]);
          document.getElementById("pin-digit-0")?.focus();
        }
      } catch {
        setErrorMsg("Network error. Please try again.");
        setPinDigits(["", "", "", ""]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCircleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inviteInput.trim(),
          name: nameInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Strictly use server-assigned role from invitation verification
        const verifiedRole: UserRole = data.role;
        onSuccess(verifiedRole);
        router.push(data.redirectUrl || "/dashboard");
        onClose();
      } else {
        setErrorMsg(
          data.error ??
            "Invalid circle code. Use demo codes: OASIS-7629 (Family), CAREGIVER-4192 (Caregiver), OBSERVER-8301 (Read-Only)"
        );
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2d4a3e] to-[#243c32] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white p-1 rounded-lg"
            aria-label="Close"
          >
            &times;
          </button>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl font-bold">Passcode Access Gateway</h3>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            Authenticate to access Eleanor Thompson&apos;s healthcare profile
          </p>

          {/* Mode Switcher */}
          <div className="mt-4 flex bg-[#1a2c24] p-1 rounded-xl border border-emerald-700/50">
            <button
              onClick={() => {
                setMode("elder");
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition-all ${
                mode === "elder" ? "bg-emerald-600 text-white shadow" : "text-emerald-200"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Elder PIN (4 Digits)</span>
            </button>
            <button
              onClick={() => {
                setMode("circle");
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition-all ${
                mode === "circle" ? "bg-emerald-600 text-white shadow" : "text-emerald-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Care Circle Code</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === "elder" ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-600 text-center">
                Enter Eleanor&apos;s 4-digit PIN for direct senior access:
              </p>
              <div className="flex justify-center space-x-3">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`pin-digit-${idx}`}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 rounded-xl border-gray-300 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all font-mono"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                Demo elder PIN: <span className="font-mono font-bold text-gray-700">1234</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleCircleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Invitation Code
                </label>
                <input
                  type="text"
                  required
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  placeholder="e.g., OASIS-7629"
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Sarah Thompson"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#2d4a3e] hover:bg-[#243c32] text-white font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-1"
              >
                {loading ? (
                  <span>Verifying...</span>
                ) : (
                  <>
                    <span>Verify Passcode & Enter</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-3 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[11px] space-y-1">
                <div className="font-semibold text-gray-700">Role-Specific Demo Codes:</div>
                <div className="flex justify-between text-gray-600">
                  <span>Family Manager:</span> <code className="font-bold text-emerald-800">OASIS-7629</code>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Caregiver:</span> <code className="font-bold text-blue-800">CAREGIVER-4192</code>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Read-Only:</span> <code className="font-bold text-purple-800">OBSERVER-8301</code>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
