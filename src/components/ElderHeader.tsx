"use client";

import React from "react";
import {
  Calendar,
  PlusCircle,
  Settings,
  Heart,
  Droplets,
  Activity,
  Pill,
  Smile,
  Shield,
  KeyRound,
} from "lucide-react";
import { CareProfile } from "@/types";

interface ElderHeaderProps {
  profile: CareProfile;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenAddAppointment: () => void;
  onOpenWhoCanSeeModal?: () => void;
  waterIntake?: number;
  moodLabel?: string;
  activeMedCount?: number;
}

export function ElderHeader({
  profile,
  selectedDate,
  onSelectDate,
  onOpenAddAppointment,
  onOpenWhoCanSeeModal,
  waterIntake = 1200,
  moodLabel = "Relaxed",
  activeMedCount = 3,
}: ElderHeaderProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8e4] p-5 sm:p-6 mb-6 transition-all">
      {/* Top Banner Tagline */}
      <div className="mb-4 pb-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs sm:text-sm text-gray-500 font-medium">
          Everything you need for clearer, calmer caregiving through one easy-to-use, intelligent dashboard.
        </p>
        {onOpenWhoCanSeeModal && (
          <button
            onClick={onOpenWhoCanSeeModal}
            className="inline-flex items-center space-x-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            <span>Who can see this?</span>
          </button>
        )}
      </div>

      {/* Main Profile Info Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Avatar + Name + Badges */}
        <div className="flex items-start sm:items-center space-x-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#e8f1ec] border-2 border-[#558d73] text-[#2d4a3e] flex items-center justify-center font-bold text-xl sm:text-2xl shadow-sm shrink-0">
            {profile.initials}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 tracking-tight">
                {profile.displayName}
              </h1>
              <span className="text-xs sm:text-sm text-gray-500 font-normal">
                {profile.age} years old
              </span>
              <button
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                title="Profile Access & Passcode Settings"
                onClick={onOpenWhoCanSeeModal}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Medical Conditions Pills matching mockup */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.conditions.map((condition) => (
                <span
                  key={condition}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f0f5f2] text-[#2d4a3e] border border-[#d6e4dc]"
                >
                  {condition}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Circle Passcode badge for quick access */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-[#fafcfb] px-3.5 py-2 rounded-xl border border-gray-200 text-xs">
          <KeyRound className="w-4 h-4 text-emerald-700" />
          <div>
            <div className="font-semibold text-gray-800">Circle Access Code</div>
            <div className="text-gray-500 font-mono tracking-wider">{profile.circleInviteCode}</div>
          </div>
        </div>
      </div>

      {/* Sub-bar: Today at a glance metrics */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Today at a glance — meds, mood, hydration, and care routines
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center space-x-2 bg-[#f9faf9] p-2.5 rounded-lg border border-gray-100">
            <Smile className="w-4 h-4 text-emerald-600" />
            <div className="text-xs">
              <span className="text-gray-400 block">Mood</span>
              <span className="font-semibold text-gray-800">{moodLabel}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[#f9faf9] p-2.5 rounded-lg border border-gray-100">
            <Droplets className="w-4 h-4 text-sky-600" />
            <div className="text-xs">
              <span className="text-gray-400 block">Water</span>
              <span className="font-semibold text-gray-800">{waterIntake} ml</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[#f9faf9] p-2.5 rounded-lg border border-gray-100">
            <Pill className="w-4 h-4 text-amber-600" />
            <div className="text-xs">
              <span className="text-gray-400 block">Active Meds</span>
              <span className="font-semibold text-gray-800">{activeMedCount} Prescribed</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[#f9faf9] p-2.5 rounded-lg border border-gray-100">
            <Activity className="w-4 h-4 text-rose-500" />
            <div className="text-xs">
              <span className="text-gray-400 block">Care Events</span>
              <span className="font-semibold text-gray-800">Recorded Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation bar matching mockup: Today, Yesterday, Two days ago + Add Appointment */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 bg-[#f0f4f1] p-1 rounded-xl">
          <button
            onClick={() => onSelectDate("Today")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedDate === "Today"
                ? "bg-[#2d4a3e] text-white shadow-sm font-semibold"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => onSelectDate("Yesterday")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedDate === "Yesterday"
                ? "bg-[#2d4a3e] text-white shadow-sm font-semibold"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => onSelectDate("Two days ago")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedDate === "Two days ago"
                ? "bg-[#2d4a3e] text-white shadow-sm font-semibold"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            Two days ago
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>04/03/2026 (Live Time)</span>
          </div>

          <button
            onClick={onOpenAddAppointment}
            className="inline-flex items-center space-x-1.5 text-xs font-medium bg-[#2d4a3e] hover:bg-[#395c4e] text-white px-3.5 py-1.5 rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-emerald-400"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add appointment</span>
          </button>
        </div>
      </div>
    </div>
  );
}
