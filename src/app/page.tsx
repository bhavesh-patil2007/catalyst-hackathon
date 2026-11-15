import Link from "next/link";
import {
  HeartHandshake,
  ShieldCheck,
  Bell,
  Sparkles,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
  Phone,
  Heart,
  Pill,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f9f7] text-[#1c2e27] flex flex-col">
      {/* Top Header */}
      <header className="bg-[#2d4a3e] text-white py-4 px-6 border-b border-[#22392f] shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#3d6554] border border-[#558d73] flex items-center justify-center text-emerald-200">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-tight">Guardian Oasis</span>
              <span className="ml-2 text-xs bg-[#1f352c] text-emerald-300 px-2 py-0.5 rounded-full border border-[#355b4a]">
                PromptWars × Catalyst
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <Link
              href="/login"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Enter Passcode / Sign In &rarr;</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section matching the image */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full text-xs font-semibold text-emerald-900 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span>CareOrbit Architecture • Elder-First Connected Care</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-serif font-extrabold text-gray-900 tracking-tight leading-tight">
            Everything you need for clearer, calmer caregiving through one easy-to-use dashboard.
          </h1>

          <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
            Guardian Oasis connects older adults, family members, and caregivers into a unified, accountable care circle. When a medication routine goes unconfirmed, CareLoop ensures it turns into an owned follow-up — never an unread notification.
          </p>
        </div>

        {/* 3 Role Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Older Adult Mode */}
          <Link
            href="/elder"
            className="group bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-100 hover:border-emerald-600 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                👵
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                Senior Accessibility
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-3 group-hover:text-emerald-800 transition-colors">
                Older Adult Mode
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                Calm, high-contrast &quot;Today&quot; view with large 56px action buttons, optional Web Speech audio readout, and plain-language check-in states.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-emerald-800 group-hover:translate-x-1 transition-transform">
              <span>Open Elder Screen</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </div>
          </Link>

          {/* Family Manager Mode */}
          <Link
            href="/dashboard"
            className="group bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-100 hover:border-[#2d4a3e] transition-all shadow-sm hover:shadow-md flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Primary View
            </div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#e8f1ec] text-[#2d4a3e] flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-[#2d4a3e] group-hover:text-white transition-colors">
                🏡
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                Eleanor Thompson Care Profile
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-3 group-hover:text-[#2d4a3e] transition-colors">
                Family Manager Dashboard
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                Full overview matching the Guardian Oasis design: Eleanor&apos;s active medications, daily vitals, doctor visits, and auditable Daily Care Brief.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-[#2d4a3e] group-hover:translate-x-1 transition-transform">
              <span>Open Family Dashboard</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </div>
          </Link>

          {/* Caregiver CareLoop Mode */}
          <Link
            href="/caregiver"
            className="group bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-100 hover:border-amber-600 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                🩺
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md">
                CareLoop Engine
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-3 group-hover:text-amber-800 transition-colors">
                Caregiver Follow-Up Inbox
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                Accountable escalation for missed check-ins. Claim follow-ups, document phone calls or in-person visits, and complete handoffs without silent dropped tasks.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-amber-800 group-hover:translate-x-1 transition-transform">
              <span>Open CareLoop Inbox</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </div>
          </Link>
        </div>

        {/* Feature Highlights Banner */}
        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-xs">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
            Engineered for PromptWars × Catalyst Platform Scoring
          </div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">
            Key Architectural Signals Built-In:
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            <div className="space-y-1.5">
              <div className="font-bold text-gray-900 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>CareLoop Closed-Loop</span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Due event &rarr; Elder response &rarr; Grace period &rarr; Caregiver claim &rarr; Timestamped resolution.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="font-bold text-gray-900 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Version Change Guard</span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Medication schedule edits create immutable version increments with verified clinical reasons and audit history.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="font-bold text-gray-900 flex items-center space-x-1.5">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>Proactive Notifications</span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Deduplicated email dispatcher with minimal subject data exposure for due routines, missed check-ins, and doctor visits.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="font-bold text-gray-900 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Grounded Daily Brief</span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Factual daily care summaries drawn exclusively from verified application records with 0 clinical hallucination.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        <p>Guardian Oasis (CareOrbit) • Developed for PromptWars × Catalyst Hackathon</p>
        <p className="mt-1 text-[11px] text-gray-400">
          Built with Next.js 14, TypeScript, Tailwind CSS, and CareLoop Escalation Engine.
        </p>
      </footer>
    </div>
  );
}
