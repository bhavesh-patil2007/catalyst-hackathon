"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import {
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Pill,
  UserCheck,
  Calendar,
  Clock,
  Filter,
} from "lucide-react";
import { AuditEvent } from "@/types";

export default function TimelinePage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<string>("ALL");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/care/today");
      const json = await res.json();
      if (json.success) {
        setEvents(json.data.auditEvents);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (filter === "ALL") return true;
    return e.entityType === filter;
  });

  return (
    <div className="min-h-screen bg-[#f6f9f7] pb-12">
      <Navbar activeRole="family_manager" onRoleChange={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Append-Only Non-Destructive Audit Log</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 mt-2">
                Shared Care & Audit Timeline
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Every medication check-in, CareLoop task escalation, caregiver handoff, and schedule version is permanently recorded.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1.5 self-start sm:self-auto">
              <button
                onClick={() => setFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  filter === "ALL" ? "bg-[#2d4a3e] text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("DOSE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  filter === "DOSE" ? "bg-[#2d4a3e] text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                Doses
              </button>
              <button
                onClick={() => setFilter("TASK")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  filter === "TASK" ? "bg-[#2d4a3e] text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                CareLoop Tasks
              </button>
              <button
                onClick={() => setFilter("MEDICATION")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  filter === "MEDICATION" ? "bg-[#2d4a3e] text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                Medications
              </button>
            </div>
          </div>
        </div>

        {/* Timeline Items */}
        <div className="space-y-3">
          {filteredEvents.map((evt, idx) => (
            <div
              key={evt.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-start space-x-3.5 hover:border-emerald-300 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                {evt.entityType === "DOSE" && <Pill className="w-4 h-4" />}
                {evt.entityType === "TASK" && <UserCheck className="w-4 h-4" />}
                {evt.entityType === "MEDICATION" && <ShieldCheck className="w-4 h-4" />}
                {evt.entityType === "APPOINTMENT" && <Calendar className="w-4 h-4" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-gray-900">{evt.actorName}</span>
                    <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.2 rounded-full uppercase">
                      {evt.actorRole}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{evt.timestamp}</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-gray-700 mt-1 leading-relaxed">
                  {evt.description}
                </p>

                <div className="mt-2 text-[10px] text-gray-400 font-mono">
                  Event ID: {evt.id} • Target: {evt.entityId}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
