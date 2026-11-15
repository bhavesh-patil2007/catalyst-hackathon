import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export async function GET() {
  const isSecretConfigured =
    Boolean(process.env.IRON_SESSION_SECRET) &&
    process.env.IRON_SESSION_SECRET !== "guardian-oasis-dev-secret-change-in-production-32";

  const dbHealth = await checkDatabaseHealth();

  return NextResponse.json({
    status: dbHealth.connected ? "healthy" : "degraded",
    service: "guardian-oasis",
    version: "1.0.0",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    checks: {
      sessionEngine: "active",
      database: dbHealth,
      resendEmail: Boolean(process.env.RESEND_API_KEY) ? "configured" : "demo-mode",
      geminiAi: Boolean(process.env.GEMINI_API_KEY) ? "configured" : "demo-mode",
      cronWatchdog: Boolean(process.env.CRON_SECRET) ? "configured" : "demo-mode",
      productionSecurityGuard: process.env.NODE_ENV === "production" ? isSecretConfigured : "dev-permissive",
    },
  });
}
