"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CareLoopTaskCard } from "@/components/CareLoopTaskCard";
import { EmailNotificationDrawer } from "@/components/EmailNotificationDrawer";
import {
  ShieldAlert,
  UserCheck,
  CheckCircle,
  Clock,
  ArrowRight,
  Phone,
  AlertTriangle,
  RefreshCw,
  Bell,
  Sparkles,
} from "lucide-react";
import { CareTask, CareProfile, NotificationJob, UserRole } from "@/types";

export default function CaregiverPage() {
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationJob[]>([]);
  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "CLAIMED" | "RESOLVED">("ALL");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/care/today");
      const json = await res.json();
      if (json.success) {
        setTasks(json.data.tasks);
        setProfile(json.data.profile);
        setNotifications(json.data.notifications);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleClaim = async (taskId: string) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "claim",
        taskId,
        caregiverName: "Priya Sharma, RN",
        actorRole: "caregiver",
      }),
    });
    const data = await res.json();
    if (data.success) {
      setBanner("Task claimed by Priya Sharma, RN. Follow-up logged.");
      setTimeout(() => setBanner(null), 4000);
      await fetchData();
    }
  };

  const handleResolve = async (
    taskId: string,
    outcome: CareTask["resolutionOutcome"],
    note: string
  ) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resolve",
        taskId,
        outcome,
        note,
        actorName: "Priya Sharma, RN",
        actorRole: "caregiver",
      }),
    });
    const data = await res.json();
    if (data.success) {
      setBanner("CareLoop follow-up resolved! Shared care timeline updated.");
      setTimeout(() => setBanner(null), 4000);
      await fetchData();
    }
  };

  const handleSimulateNewEscalation = async () => {
    const res = await fetch("/api/care/escalate-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.success) {
      setBanner("Simulated grace window expiry: New follow-up task added to Caregiver Inbox!");
      setTimeout(() => setBanner(null), 4000);
      await fetchData();
    }
  };

  const handleTriggerTestEmail = async (email: string, type: string) => {
    await fetch("/api/notifications/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientEmail: email,
        recipientRole: "Caregiver",
        type,
      }),
    });
    await fetchData();
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "ALL") return true;
    return t.status === filter;
  });

  const openCount = tasks.filter((t) => t.status === "OPEN").length;
  const claimedCount = tasks.filter((t) => t.status === "CLAIMED").length;
  const resolvedCount = tasks.filter((t) => t.status === "RESOLVED").length;

  return (
    <div className="min-h-screen bg-[#f6f9f7] pb-12">
      <Navbar
        activeRole="caregiver"
        onRoleChange={() => {}}
        unreadAlertsCount={notifications.length}
        onOpenEmailDrawer={() => setIsEmailDrawerOpen(true)}
      />

      {banner && (
        <div className="bg-[#2d4a3e] text-white p-3 text-center text-xs font-semibold shadow-xs flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span>{banner}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  CareLoop Action Layer
                </span>
                <span className="text-xs text-gray-500">
                  Assigned Caregiver: <strong>Priya Sharma, RN</strong>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 mt-2">
                CareLoop Escalation Inbox
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Turns unconfirmed medication check-ins into clear, owned follow-up tasks with documented resolutions.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleSimulateNewEscalation}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3.5 py-2 rounded-xl transition-colors"
                title="Simulates an unconfirmed routine timeout"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Simulate Unconfirmed Routine</span>
              </button>

              <button
                onClick={() => setIsEmailDrawerOpen(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-[#2d4a3e] hover:bg-[#385b4c] text-white px-3.5 py-2 rounded-xl transition-colors shadow-xs"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Email Logs ({notifications.length})</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Counts */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "ALL" ? "bg-[#2d4a3e] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setFilter("OPEN")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "OPEN" ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-800 hover:bg-rose-100"
              }`}
            >
              Unclaimed ({openCount})
            </button>
            <button
              onClick={() => setFilter("CLAIMED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "CLAIMED" ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
            >
              In Progress ({claimedCount})
            </button>
            <button
              onClick={() => setFilter("RESOLVED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "RESOLVED" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Task cards list */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <h3 className="font-bold text-gray-900 text-base">All Caught Up!</h3>
              <p className="text-xs text-gray-500 mt-1">
                No active follow-up tasks in this view. All routines are verified or resolved.
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <CareLoopTaskCard
                key={task.id}
                task={task}
                activeRole="caregiver"
                currentCaregiverName="Priya Sharma, RN"
                onClaim={handleClaim}
                onResolve={handleResolve}
              />
            ))
          )}
        </div>
      </main>

      <EmailNotificationDrawer
        isOpen={isEmailDrawerOpen}
        onClose={() => setIsEmailDrawerOpen(false)}
        notifications={notifications}
        onTriggerTestEmail={handleTriggerTestEmail}
      />
    </div>
  );
}
