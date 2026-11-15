"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HeartHandshake,
  Heart,
  Bell,
  Volume2,
  VolumeX,
  Type,
  SunMoon,
  Sparkles,
  Lock,
  LogOut,
  User,
  Shield,
} from "lucide-react";
import { PasscodeGateModal } from "./PasscodeGateModal";
import { UserRole } from "@/types";

interface NavbarProps {
  activeRole: string;
  onRoleChange: (role: string) => void;
  unreadAlertsCount?: number;
  onOpenEmailDrawer?: () => void;
  onOpenCareBrief?: () => void;
}

export function Navbar({
  activeRole,
  onRoleChange,
  unreadAlertsCount = 0,
  onOpenEmailDrawer,
  onOpenCareBrief,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("normal");
  const [highContrast, setHighContrast] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);

  // Authenticated server session state
  const [sessionUser, setSessionUser] = useState<{
    authenticated: boolean;
    role?: UserRole;
    memberName?: string;
  }>({ authenticated: false });

  // Sync real authenticated session on mount and route changes
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.role) {
          setSessionUser({
            authenticated: true,
            role: data.role,
            memberName: data.memberName,
          });
          onRoleChange(data.role);
        }
      })
      .catch(() => {});
  }, [pathname, onRoleChange]);

  const toggleFontSize = () => {
    const next = fontSize === "normal" ? "large" : fontSize === "large" ? "xlarge" : "normal";
    setFontSize(next);
    if (typeof document !== "undefined") {
      document.body.classList.remove("font-large", "font-xlarge");
      if (next === "large") document.body.classList.add("font-large");
      if (next === "xlarge") document.body.classList.add("font-xlarge");
    }
  };

  const toggleContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    if (typeof document !== "undefined") {
      document.body.classList.toggle("high-contrast", next);
    }
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(
        "Voice assistance is enabled. Guardian Oasis will narrate your medication and appointment updates."
      );
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handlePasscodeSuccess = (role: UserRole) => {
    setIsPasscodeModalOpen(false);
    onRoleChange(role);
    setSessionUser({
      authenticated: true,
      role,
      memberName: sessionUser.memberName || "Authenticated Member",
    });
    if (role === "owner") {
      router.push("/elder");
    } else if (role === "caregiver") {
      router.push("/caregiver");
    } else if (role === "read_only") {
      router.push("/timeline");
    } else {
      router.push("/dashboard");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setSessionUser({ authenticated: false });
    router.push("/login");
  };

  // Safe role switcher: requires authentication if switching to a non-authenticated role
  const handleRolePillClick = (targetRole: UserRole) => {
    if (sessionUser.role !== targetRole) {
      setIsPasscodeModalOpen(true);
    } else {
      if (targetRole === "owner") router.push("/elder");
      else if (targetRole === "caregiver") router.push("/caregiver");
      else router.push("/dashboard");
    }
  };

  const navItems = [
    { label: "Family Home", href: "/dashboard", icon: null },
    { label: "Today (Elder)", href: "/elder", icon: null },
    { label: "CareLoop Inbox", href: "/caregiver", icon: null },
    { label: "Medications", href: "/medications", icon: null },
    { label: "Appointments", href: "/appointments", icon: null },
    { label: "Timeline", href: "/timeline", icon: null },
    { label: "Wellbeing", href: "/wellbeing", icon: <Heart className="w-3.5 h-3.5 inline-block mr-1 text-emerald-300" /> },
    { label: "MedSutra AI", href: "/medsutra", icon: <Sparkles className="w-3.5 h-3.5 inline-block mr-1 text-amber-300" /> },
  ];

  const currentRole = sessionUser.role || (activeRole as UserRole) || "family_manager";

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#2d4a3e] text-white shadow-md border-b border-[#243c32]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Brand */}
            <div className="flex items-center space-x-3">
              <a
                href={currentRole === "owner" ? "/elder" : "/dashboard"}
                className="flex items-center space-x-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-300 rounded-lg p-1"
                aria-label="Guardian Oasis Home"
              >
                <div className="w-9 h-9 rounded-full bg-[#3d6554] border border-[#558d73] flex items-center justify-center text-emerald-200 shadow-inner">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <span className="font-serif text-xl font-bold tracking-tight text-white drop-shadow-sm">
                  Guardian Oasis
                </span>
              </a>
              <span className="hidden md:inline-block text-xs bg-[#1f352c] text-emerald-300 px-2.5 py-0.5 rounded-full font-medium border border-[#355b4a]">
                CareLoop Enabled
              </span>
            </div>

            {/* Navigation links */}
            <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#3d6554] text-white shadow-sm font-semibold"
                        : "text-emerald-100/90 hover:bg-[#385b4c] hover:text-white"
                    }`}
                  >
                    {item.icon}{item.label}
                  </a>
                );
              })}
            </nav>

            {/* Right tool actions */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Passcode Access Button */}
              <button
                onClick={() => setIsPasscodeModalOpen(true)}
                className="inline-flex items-center space-x-1.5 text-xs bg-[#22392f] hover:bg-[#1a2c24] text-emerald-300 px-2.5 py-1.5 rounded-lg border border-[#375a4a] transition-colors"
                title="Secure Passcode Access Gateway"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Passcode</span>
              </button>

              {/* AI Daily Care Brief button */}
              {onOpenCareBrief && (
                <button
                  onClick={onOpenCareBrief}
                  className="hidden sm:flex items-center space-x-1.5 bg-[#3e6856] hover:bg-[#4b7c67] text-emerald-100 text-xs px-2.5 py-1.5 rounded-md border border-[#558d73] transition-all shadow-sm"
                  title="View Grounded Daily Care Brief"
                  aria-label="View Daily Care Brief"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span className="font-medium">Care Brief</span>
                </button>
              )}

              {/* Accessibility Controls */}
              <div className="flex items-center bg-[#233a30] rounded-lg p-0.5 border border-[#355848]">
                <button
                  onClick={toggleVoice}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    voiceEnabled ? "bg-emerald-500 text-white" : "text-emerald-200 hover:text-white"
                  }`}
                  title={voiceEnabled ? "Voice Narration On" : "Enable Voice Readout"}
                  aria-label="Toggle Voice Readout"
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                <button
                  onClick={toggleFontSize}
                  className="p-1.5 rounded text-xs text-emerald-200 hover:text-white transition-colors"
                  title={`Text size: ${fontSize}`}
                  aria-label="Adjust font size"
                >
                  <Type className="w-4 h-4" />
                </button>

                <button
                  onClick={toggleContrast}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    highContrast ? "bg-yellow-400 text-black font-bold" : "text-emerald-200 hover:text-white"
                  }`}
                  title="Toggle High Contrast"
                  aria-label="Toggle High Contrast"
                >
                  <SunMoon className="w-4 h-4" />
                </button>
              </div>

              {/* Proactive Email Notifications Drawer */}
              {onOpenEmailDrawer && (
                <button
                  onClick={onOpenEmailDrawer}
                  className="relative p-2 rounded-lg bg-[#385b4c] hover:bg-[#436e5b] text-emerald-100 border border-[#4d7b67] transition-colors focus:ring-2 focus:ring-emerald-300"
                  title="View Dispatched Email Alerts & Logs"
                  aria-label="View email alerts"
                >
                  <Bell className="w-4 h-4" />
                  {unreadAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-sm">
                      {unreadAlertsCount}
                    </span>
                  )}
                </button>
              )}

              {/* Role Indicator & Authenticated Session Tag */}
              <div className="flex items-center bg-[#1d3128] rounded-full p-1 border border-[#375a4a] text-xs">
                <button
                  onClick={() => handleRolePillClick("owner")}
                  className={`px-2.5 py-1 rounded-full transition-all ${
                    currentRole === "owner"
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "text-emerald-300 hover:text-white"
                  }`}
                  title="Older Adult Mode (Click to authenticate)"
                >
                  Older Adult
                </button>
                <button
                  onClick={() => handleRolePillClick("family_manager")}
                  className={`px-2.5 py-1 rounded-full transition-all ${
                    currentRole === "family_manager"
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "text-emerald-300 hover:text-white"
                  }`}
                  title="Family Mode (Click to authenticate)"
                >
                  Family
                </button>
                <button
                  onClick={() => handleRolePillClick("caregiver")}
                  className={`px-2.5 py-1 rounded-full transition-all ${
                    currentRole === "caregiver"
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "text-emerald-300 hover:text-white"
                  }`}
                  title="Caregiver Mode (Click to authenticate)"
                >
                  Caregiver
                </button>
              </div>

              {/* Functional Logout Option */}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 transition-colors"
                title="Log out of CareOrbit"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Passcode Gate Modal */}
      <PasscodeGateModal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
        onSuccess={handlePasscodeSuccess}
      />
    </>
  );
}
