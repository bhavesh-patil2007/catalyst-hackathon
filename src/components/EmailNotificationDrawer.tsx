"use client";

import React, { useState } from "react";
import {
  X,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { NotificationJob } from "@/types";

interface EmailNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationJob[];
  onTriggerTestEmail: (email: string, type: string) => Promise<void>;
}

export function EmailNotificationDrawer({
  isOpen,
  onClose,
  notifications,
  onTriggerTestEmail,
}: EmailNotificationDrawerProps) {
  const [recipientEmail, setRecipientEmail] = useState("caregiver@oasiscare.demo.local");
  const [selectedType, setSelectedType] = useState("MISSED_DOSE_ESCALATION");
  const [sending, setSending] = useState(false);
  const [lastSentMsg, setLastSentMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setLastSentMsg(null);
    try {
      await onTriggerTestEmail(recipientEmail, selectedType);
      setLastSentMsg(`Delivered alert to ${recipientEmail}`);
    } catch (err) {
      setLastSentMsg("Error sending email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-gray-200">
        {/* Header */}
        <div className="p-5 bg-[#2d4a3e] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#385b4c] flex items-center justify-center text-emerald-200">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base">Proactive Email Engine</h3>
              <p className="text-xs text-emerald-200">Deduplicated transactional alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-[#385b4c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Test Email Dispatch Form */}
        <div className="p-4 bg-emerald-50/60 border-b border-emerald-100">
          <div className="text-xs font-bold text-emerald-950 mb-1 flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
            <span>Live Demonstration Dispatcher</span>
          </div>
          <p className="text-xs text-emerald-800 mb-3">
            Trigger a real proactive notification to any recipient email address to test the email loop:
          </p>

          <form onSubmit={handleSendTest} className="space-y-2.5">
            <div>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Enter recipient email..."
                className="w-full text-xs border border-emerald-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="flex-1 text-xs border border-emerald-200 rounded-lg px-2.5 py-2 bg-white text-gray-900"
              >
                <option value="MISSED_DOSE_ESCALATION">Missed Dose Escalation</option>
                <option value="DOSE_DUE">Scheduled Dose Reminder</option>
                <option value="APPOINTMENT_REMINDER">Doctor Appointment Reminder</option>
              </select>

              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center space-x-1.5 bg-[#2d4a3e] hover:bg-[#395c4e] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? "Sending..." : "Dispatch"}</span>
              </button>
            </div>

            {lastSentMsg && (
              <div className="text-xs text-emerald-800 font-medium bg-emerald-100/70 p-2 rounded-lg flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>{lastSentMsg}</span>
              </div>
            )}
          </form>
        </div>

        {/* Sent notifications history */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Sent Notifications Log ({notifications.length})
          </div>

          {notifications.map((item) => (
            <div
              key={item.id}
              className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold text-gray-700">{item.recipientRole}</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{item.timestamp}</span>
                </span>
              </div>

              <div className="font-semibold text-xs text-gray-900 mb-1">
                {item.subject}
              </div>

              <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                {item.bodyPreview}
              </p>

              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-200/60 text-gray-400">
                <span className="truncate max-w-[200px]">To: {item.recipientEmail}</span>
                <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Deduplicated</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
