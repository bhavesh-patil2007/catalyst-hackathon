"use client";

import React, { useState } from "react";
import { Lock, AlertCircle } from "lucide-react";
import { UserRole } from "@/types";

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
  elderPin = "1234",
  circleInviteCode = "OASIS-7629",
}: PasscodeGateModalProps) {
  const [mode, setMode] = useState<"elder" | "circle">("elder");
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [inviteInput, setInviteInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("family_manager");
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
        if (res.ok) {
          onSuccess("owner");
        } else {
          const data = await res.json().catch(() => ({}));
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
          email: emailInput.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data.role ?? selectedRole);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? `Invalid Circle Code. Use demo code '${circleInviteCode}'`);
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#2d4a3e] p-6 text-white text-center">
          <div className="w-12 h-12 rounded-full bg-[#3d6554] border border-[#558d73] flex items-center justify-center mx-auto mb-3 text-emerald-200 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-xl">Secure Passcode Access</h3>
          <p className="text-xs text-emerald-200 mt-1">
            Care profile access for Eleanor Thompson
          </p>

          {/* Toggle between Elder Quick PIN vs Care Circle Passcode */}
          <div className="mt-4 flex bg-[#1d3128] p-1 rounded-xl border border-[#375a4a] text-xs">
            <button
              onClick={() => {
                setMode("elder");
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                mode === "elder" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-300"
              }`}
            >
              Older Adult (4-Digit PIN)
            </button>
            <button
              onClick={() => {
                setMode("circle");
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                mode === "circle" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-300"
              }`}
            >
              Care Circle Code
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {mode === "elder" ? (
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-4">
                Enter your senior quick 4-digit PIN to open your simplified Today view:
              </p>

              {/* 4 Digit PIN inputs */}
              <div className="flex justify-center space-x-3 mb-4">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`pin-digit-${idx}`}
                    type="password"
                    maxLength={1}
                    value={digit}
                    disabled={loading}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition-all disabled:opacity-50"
                  />
                ))}
              </div>

              {loading && (
                <p className="text-xs text-emerald-600 font-medium animate-pulse mb-2">
                  Verifying…
                </p>
              )}

              <p className="text-[11px] text-gray-400 font-mono">
                Demo Elder PIN: <strong>{elderPin}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={handleCircleSubmit} className="space-y-4">
              <p className="text-xs text-gray-600">
                Authorized family members and caregivers: Enter your household access code to sign in.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Circle Invite / Access Code
                </label>
                <input
                  type="text"
                  required
                  value={inviteInput}
                  onChange={(e) => {
                    setInviteInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. OASIS-7629"
                  className="w-full text-center tracking-widest uppercase font-mono font-bold text-sm border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Your Name (optional)
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Sarah Thompson"
                  className="w-full text-sm border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Accessing As
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900"
                >
                  <option value="family_manager">Family Manager (Sarah Thompson)</option>
                  <option value="caregiver">Assigned Caregiver (Priya Sharma, RN)</option>
                  <option value="read_only">Family Member - View Only (David)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2d4a3e] hover:bg-[#385b4c] text-white text-xs font-bold py-3 rounded-xl shadow-xs transition-colors disabled:opacity-60"
              >
                {loading ? "Authenticating…" : "Authenticate & Access Profile"}
              </button>

              <p className="text-[11px] text-gray-400 text-center font-mono">
                Demo Code: <strong>{circleInviteCode}</strong>
              </p>
            </form>
          )}

          {errorMsg && (
            <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-center space-x-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs">
          <span className="text-gray-400">Security &amp; Privacy by Design</span>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
