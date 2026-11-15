"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Pill,
  PlusCircle,
  History,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Edit3,
  X,
  FileText,
} from "lucide-react";
import { Medication, MedicationVersion } from "@/types";

export default function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [allVersions, setAllVersions] = useState<MedicationVersion[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [viewingHistoryMed, setViewingHistoryMed] = useState<Medication | null>(null);

  // Add form state
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scheduleTime, setScheduleTime] = useState("08:00 AM");
  const [slot, setSlot] = useState<"morning" | "afternoon" | "evening" | "bedtime">("morning");
  const [pillColor, setPillColor] = useState("emerald");
  const [reason, setReason] = useState("");
  const [authorName, setAuthorName] = useState("Sarah Thompson (Family Manager)");

  // Edit form state
  const [editDosage, setEditDosage] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editScheduleTime, setEditScheduleTime] = useState("");
  const [editSlot, setEditSlot] = useState<"morning" | "afternoon" | "evening" | "bedtime">("morning");
  const [editReason, setEditReason] = useState("");

  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/care/today");
      const json = await res.json();
      if (json.success) {
        setMedications(json.data.medications);
        setAllVersions(json.data.versions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dosage || !instructions || !reason) {
      alert("Please fill in all required fields including the clinical reason.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dosage,
          instructions,
          scheduleTime,
          slot,
          pillColor,
          pillShape: "capsule",
          reason,
          authorName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBanner(`Medication ${name} created with Version Guard v1.`);
        setShowAddForm(false);
        setName("");
        setDosage("");
        setInstructions("");
        setReason("");
        setTimeout(() => setBanner(null), 4000);
        await fetchData();
      } else {
        alert(data.error || "Failed to add medication");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (med: Medication) => {
    setEditingMed(med);
    setEditDosage(med.dosage);
    setEditInstructions(med.instructions);
    setEditScheduleTime(med.scheduleTime);
    setEditSlot(med.slot);
    setEditReason("");
  };

  const handleEditMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMed || !editReason) {
      alert("Please provide the clinical reason for updating the medication schedule.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/medications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: editingMed.id,
          dosage: editDosage,
          instructions: editInstructions,
          scheduleTime: editScheduleTime,
          slot: editSlot,
          reason: editReason,
          authorName: "Sarah Thompson (Family Manager)",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBanner(`${editingMed.name} updated to Version ${data.data.currentVersion}.0. Version guard logged.`);
        setEditingMed(null);
        setTimeout(() => setBanner(null), 4000);
        await fetchData();
      } else {
        alert(data.error || "Failed to update medication");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f9f7] pb-12">
      <Navbar activeRole="family_manager" onRoleChange={() => {}} />

      {banner && (
        <div className="bg-[#2d4a3e] text-white p-3 text-center text-xs font-semibold shadow-xs flex items-center justify-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{banner}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Immutable Schedule Versioning Active</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 mt-2">
              Medication Management & Change Guard
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              Every schedule update is preserved in a permanent version history with author and clinical rationale.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center space-x-1.5 bg-[#2d4a3e] hover:bg-[#385b4c] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showAddForm ? "Close Form" : "Add Medication"}</span>
          </button>
        </div>

        {/* Add Medication Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddMedication}
            className="bg-white rounded-2xl border-2 border-emerald-300 p-6 mb-6 shadow-sm animate-in fade-in space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">
                New Medication Prescription Entry
              </h3>
              <span className="text-xs text-gray-500">Requires explicit reason</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Medication Name *
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Glipizide"
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dosage / Strength *
                </label>
                <input
                  required
                  type="text"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g. 5 mg (1 tablet)"
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Scheduled Time
                </label>
                <input
                  type="text"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  placeholder="e.g. 08:00 AM"
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Time Slot</label>
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value as any)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="bedtime">Bedtime</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Badge Color</label>
                <select
                  value={pillColor}
                  onChange={(e) => setPillColor(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                >
                  <option value="emerald">Emerald Green</option>
                  <option value="sky">Sky Blue</option>
                  <option value="amber">Amber Yellow</option>
                  <option value="rose">Rose Red</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Instructions / Timing with Meals *
              </label>
              <input
                required
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Take 30 minutes before breakfast with water."
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Change Reason & Clinician Source *
              </label>
              <input
                required
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Prescribed by Dr. Robert Vance during cardiology visit Nov 15"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold bg-[#2d4a3e] hover:bg-[#385b4c] text-white rounded-lg shadow-xs disabled:opacity-50"
              >
                {loading ? "Recording Version..." : "Save Medication with Version Guard"}
              </button>
            </div>
          </form>
        )}

        {/* Edit Medication Modal */}
        {editingMed && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-emerald-700" />
                  <h3 className="font-bold text-base text-gray-900">
                    Edit {editingMed.name} Schedule
                  </h3>
                </div>
                <button
                  onClick={() => setEditingMed(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditMedication} className="space-y-3.5 mt-4">
                <div className="bg-emerald-50 p-2.5 rounded-xl text-xs text-emerald-900">
                  Updating this medication will create immutable <strong>Version {editingMed.currentVersion + 1}.0</strong>.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      New Dosage / Strength *
                    </label>
                    <input
                      required
                      type="text"
                      value={editDosage}
                      onChange={(e) => setEditDosage(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Scheduled Time *
                    </label>
                    <input
                      required
                      type="text"
                      value={editScheduleTime}
                      onChange={(e) => setEditScheduleTime(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Updated Instructions
                  </label>
                  <input
                    type="text"
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-rose-800 mb-1">
                    Clinical Change Reason (Required by Guard) *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g. Physician increased dosage from 500mg to 1000mg following HbA1c lab result"
                    className="w-full text-xs border border-rose-300 rounded-lg p-2.5 bg-rose-50/50 text-gray-900"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingMed(null)}
                    className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl shadow-xs"
                  >
                    {loading ? "Incrementing Version..." : `Save Version ${editingMed.currentVersion + 1}.0`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Version History Modal */}
        {viewingHistoryMed && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-emerald-700" />
                  <h3 className="font-bold text-base text-gray-900">
                    Version History: {viewingHistoryMed.name}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingHistoryMed(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 py-4 flex-1">
                {allVersions
                  .filter((v) => v.medicationId === viewingHistoryMed.id)
                  .map((v) => (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                          Version {v.version}.0
                        </span>
                        <span className="text-[11px] text-gray-400">{v.effectiveFrom}</span>
                      </div>
                      <div className="text-xs font-semibold text-gray-900">
                        {v.labelName} &bull; {v.instructions}
                      </div>
                      <div className="text-[11px] text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                        <strong>Reason:</strong> {v.reason}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Authorized by: {v.createdBy}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Existing Medications Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {medications.map((med) => (
            <div
              key={med.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:border-[#4a7c68] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{med.name}</h3>
                      <p className="text-xs text-gray-500 font-medium">{med.dosage}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-200">
                    Version {med.currentVersion}.0 (Active)
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs text-gray-600">
                  <div className="flex items-center space-x-1.5 text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Scheduled for <strong>{med.scheduleTime}</strong> ({med.slot})</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                      Instructions
                    </span>
                    {med.instructions}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <button
                  onClick={() => setViewingHistoryMed(med)}
                  className="text-emerald-800 hover:text-emerald-900 font-medium inline-flex items-center space-x-1"
                >
                  <History className="w-3 h-3" />
                  <span>Version History</span>
                </button>

                <button
                  onClick={() => startEdit(med)}
                  className="bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 px-3 py-1.5 rounded-lg font-semibold text-xs inline-flex items-center space-x-1 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Schedule</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
