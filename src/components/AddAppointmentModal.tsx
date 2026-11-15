"use client";

import React, { useState } from "react";
import { X, Calendar, Clock, MapPin, User, Stethoscope, Car } from "lucide-react";
import { DoctorAppointment } from "@/types";

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (appt: Omit<DoctorAppointment, "id" | "careProfileId">) => Promise<void>;
}

export function AddAppointmentModal({
  isOpen,
  onClose,
  onAdd,
}: AddAppointmentModalProps) {
  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("General Medicine / Geriatrics");
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [dateTime, setDateTime] = useState("Nov 20, 11:00 AM");
  const [dateLabel, setDateLabel] = useState("Nov 20");
  const [timeLabel, setTimeLabel] = useState("11:00 AM");
  const [transportAssigned, setTransportAssigned] = useState(true);
  const [transportDetails, setTransportDetails] = useState("Daughter Sarah driving");
  const [questionText, setQuestionText] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName || !clinicName) return;

    setLoading(true);
    try {
      await onAdd({
        doctorName,
        specialty,
        clinicName,
        address,
        dateTime,
        dateLabel,
        timeLabel,
        transportAssigned,
        transportDetails,
        questionsToAsk: questionText ? questionText.split("\n").filter(Boolean) : [],
        status: "UPCOMING",
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-[#2d4a3e] p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3d6554] flex items-center justify-center text-emerald-200">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base">Schedule Doctor Appointment</h3>
              <p className="text-xs text-emerald-200">With transport & pre-visit checklist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-[#385b4c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Doctor Name</label>
              <input
                required
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Robert Vance, MD"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Specialty</label>
              <input
                required
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Cardiology"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Clinic Name</label>
              <input
                required
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. St. Jude Wellness Center"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Address / Room</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 420 Maple Ave, Suite 300"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date Label</label>
              <input
                type="text"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                placeholder="e.g. Nov 20"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Time Label</label>
              <input
                type="text"
                value={timeLabel}
                onChange={(e) => setTimeLabel(e.target.value)}
                placeholder="e.g. 11:00 AM"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* Transport Assigned */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <label className="flex items-center space-x-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={transportAssigned}
                onChange={(e) => setTransportAssigned(e.target.checked)}
                className="rounded text-emerald-700 focus:ring-emerald-500"
              />
              <span className="text-xs font-semibold text-gray-800">
                Transport Arranged / Escort Assigned
              </span>
            </label>
            {transportAssigned && (
              <input
                type="text"
                value={transportDetails}
                onChange={(e) => setTransportDetails(e.target.value)}
                placeholder="Who is driving / escorting?"
                className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-900"
              />
            )}
          </div>

          {/* Questions to ask */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Questions to ask during consultation (1 per line)
            </label>
            <textarea
              rows={2}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="e.g. Review BP medication dosage&#10;Check on ankle swelling"
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold bg-[#2d4a3e] hover:bg-[#385b4c] text-white rounded-lg shadow-sm disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
