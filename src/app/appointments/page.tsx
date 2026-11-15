"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { AddAppointmentModal } from "@/components/AddAppointmentModal";
import {
  Calendar,
  PlusCircle,
  MapPin,
  Car,
  FileText,
  CheckCircle2,
  Stethoscope,
  Clock,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { DoctorAppointment } from "@/types";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/care/today");
      const json = await res.json();
      if (json.success) {
        setAppointments(json.data.appointments);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddAppointment = async (
    appt: Omit<DoctorAppointment, "id" | "careProfileId">
  ) => {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appt),
    });
    const data = await res.json();
    if (data.success) {
      setBanner("Doctor appointment scheduled!");
      setTimeout(() => setBanner(null), 4000);
      await fetchData();
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
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>Care Visits & Transport Preparation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 mt-2">
              Doctor Appointments Companion
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              Tracks upcoming clinical consultations, transport arrangements, and pre-visit questions for the physician.
            </p>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-[#2d4a3e] hover:bg-[#385b4c] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Schedule Appointment</span>
          </button>
        </div>

        {/* Appointments List */}
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs hover:border-[#4a7c68] transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{appt.doctorName}</h3>
                    <p className="text-xs text-gray-500 font-medium">{appt.specialty}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                    {appt.dateTime}
                  </span>
                  {appt.transportAssigned ? (
                    <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full inline-flex items-center space-x-1">
                      <Car className="w-3.5 h-3.5" />
                      <span>Transport Confirmed</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                      Transport Needed
                    </span>
                  )}
                </div>
              </div>

              {/* Location & Transport details */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
                <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-800 block">{appt.clinicName}</span>
                    <span className="text-gray-500">{appt.address}</span>
                  </div>
                </div>

                {appt.transportDetails && (
                  <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <Car className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <span className="font-semibold text-gray-800 block">Transit Details</span>
                      <span className="text-gray-500">{appt.transportDetails}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Questions to ask */}
              {appt.questionsToAsk.length > 0 && (
                <div className="mt-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Questions to Ask Doctor</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-700">
                    {appt.questionsToAsk.map((q, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <span className="text-emerald-700 font-bold">•</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Post-visit clinical notes */}
              {appt.postVisitNotes && (
                <div className="mt-3 text-xs text-gray-500 italic bg-gray-50 p-3 rounded-xl border border-gray-100">
                  Previous visit record: {appt.postVisitNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      <AddAppointmentModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={handleAddAppointment}
      />
    </div>
  );
}
