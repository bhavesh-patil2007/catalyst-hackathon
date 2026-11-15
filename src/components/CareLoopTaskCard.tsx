"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  UserCheck,
  CheckCircle,
  ArrowRight,
  PhoneCall,
  Home,
  MessageSquare,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { CareTask, UserRole } from "@/types";

interface CareLoopTaskCardProps {
  task: CareTask;
  activeRole: UserRole;
  currentCaregiverName: string;
  onClaim: (taskId: string) => Promise<void> | void;
  onResolve: (
    taskId: string,
    outcome: CareTask["resolutionOutcome"],
    note: string
  ) => Promise<void> | void;
}

export function CareLoopTaskCard({
  task,
  activeRole,
  currentCaregiverName,
  onClaim,
  onResolve,
}: CareLoopTaskCardProps) {
  const [resolving, setResolving] = useState(false);
  const [outcome, setOutcome] = useState<CareTask["resolutionOutcome"]>("spoke_with_elder");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    setLoading(true);
    try {
      await onClaim(task.id);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!note.trim()) {
      alert("Please provide a brief follow-up note before resolving this care task.");
      return;
    }
    setLoading(true);
    try {
      await onResolve(task.id, outcome, note);
      setResolving(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-5 transition-all shadow-sm ${
        task.status === "RESOLVED"
          ? "bg-gray-50/70 border-gray-200"
          : task.status === "CLAIMED"
          ? "bg-amber-50/30 border-amber-300"
          : "bg-rose-50/40 border-rose-300"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left info */}
        <div className="flex items-start space-x-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              task.status === "RESOLVED"
                ? "bg-emerald-100 text-emerald-800"
                : task.status === "CLAIMED"
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800 animate-pulse"
            }`}
          >
            {task.status === "RESOLVED" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                #{task.id}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  task.status === "RESOLVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : task.status === "CLAIMED"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {task.status === "OPEN" ? "Unclaimed Escalation" : task.status}
              </span>
              <span className="text-xs text-gray-400">Created {task.createdAt}</span>
            </div>

            <h4 className="text-base font-bold text-gray-900 mt-1">
              Missed Check-in: {task.medicationName} ({task.doseText})
            </h4>

            <p className="text-xs text-gray-600 mt-0.5">
              Scheduled for {task.scheduledTime} • Grace period expired ({task.graceMinutesExpired} mins).
              Assigned to: <strong>{task.assignedToName}</strong>
            </p>

            {/* Claimed or Resolved metadata */}
            {task.status === "CLAIMED" && (
              <div className="mt-2 text-xs text-amber-900 bg-amber-100/70 px-2.5 py-1 rounded-md inline-flex items-center space-x-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  Claimed by <strong>{task.claimedBy}</strong> at {task.claimedAt}. Follow-up in progress.
                </span>
              </div>
            )}

            {task.status === "RESOLVED" && (
              <div className="mt-2 text-xs text-emerald-900 bg-emerald-100/70 px-2.5 py-1 rounded-md inline-flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>
                  Resolved at {task.resolvedAt} • Outcome: <strong>{task.resolutionOutcome}</strong>. Note: &quot;{task.resolutionNote}&quot;
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right CTA Actions */}
        <div className="shrink-0 self-start sm:self-center">
          {task.status === "OPEN" && (
            <button
              disabled={loading}
              onClick={handleClaim}
              className="inline-flex items-center space-x-2 bg-[#2d4a3e] hover:bg-[#385b4c] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>Claim this task</span>
            </button>
          )}

          {task.status === "CLAIMED" && !resolving && (
            <button
              onClick={() => setResolving(true)}
              className="inline-flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-emerald-400"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Record Resolution</span>
            </button>
          )}
        </div>
      </div>

      {/* Resolution input form */}
      {resolving && (
        <div className="mt-4 pt-4 border-t border-amber-200">
          <div className="text-xs font-bold text-gray-800 mb-2">
            Record Follow-Up Resolution & Handoff Note:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Follow-Up Action</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as any)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-900"
              >
                <option value="spoke_with_elder">Spoke with Eleanor by phone</option>
                <option value="visited_in_person">Visited in person & administered</option>
                <option value="self_resolved">Elder reported they already took it</option>
                <option value="unable_to_reach">Unable to reach (alerting backup family)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Handoff / Care Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Confirmed taken with light tea; vitals stable."
                className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-900"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setResolving(false)}
              className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-300"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              onClick={handleResolve}
              className="text-xs font-semibold bg-[#2d4a3e] hover:bg-[#385b4c] text-white px-4 py-1.5 rounded-lg shadow-sm"
            >
              {loading ? "Saving..." : "Submit & Close Loop"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
