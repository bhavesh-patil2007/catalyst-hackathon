"use client";

import React from "react";
import { X, ShieldCheck, Users, KeyRound, Lock, Eye } from "lucide-react";
import { CareProfile, CareMember } from "@/types";

interface WhoCanSeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CareProfile;
  members: CareMember[];
}

export function WhoCanSeeModal({
  isOpen,
  onClose,
  profile,
  members,
}: WhoCanSeeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in">
        {/* Header */}
        <div className="bg-[#2d4a3e] p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3d6554] flex items-center justify-center text-emerald-200">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg">Who Can See This?</h3>
              <p className="text-xs text-emerald-200">
                Elder-first access transparency & permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-[#385b4c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
            <strong>Elder Transparency Notice:</strong> You own this care profile. Only individuals you authorize can see your routines. No notifications are sent to unauthorized persons.
          </div>

          {/* Access Codes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center space-x-1.5 text-xs text-gray-500 mb-1">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Senior Quick PIN</span>
              </div>
              <div className="text-base font-mono font-bold text-gray-900">
                {profile.passcode}
              </div>
              <div className="text-[11px] text-gray-400">For 1-tap fast elder sign-in</div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center space-x-1.5 text-xs text-gray-500 mb-1">
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                <span>Circle Invite Code</span>
              </div>
              <div className="text-base font-mono font-bold text-emerald-800">
                {profile.circleInviteCode}
              </div>
              <div className="text-[11px] text-gray-400">For family & caregiver join</div>
            </div>
          </div>

          {/* Member list */}
          <div>
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Authorized Care Circle Members ({members.length})</span>
            </div>

            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                >
                  <div>
                    <div className="font-bold text-gray-900 flex items-center space-x-2">
                      <span>{m.name}</span>
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full capitalize">
                        {m.role.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {m.relationship} • {m.email}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-gray-400">
                    {m.role === "owner" && "Full Owner Access"}
                    {m.role === "family_manager" && "Schedules & Overview"}
                    {m.role === "caregiver" && "Assigned Care Tasks"}
                    {m.role === "read_only" && "View Only"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#2d4a3e] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#385b4c] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
