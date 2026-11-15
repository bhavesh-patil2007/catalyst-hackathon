import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export async function GET() {
  const isSecretConfigured =
    Boolean(process.env.IRON_SESSION_SECRET) &&
    process.env.IRON_SESSION_SECRET !== "guardian-oasis-dev-secret-change-in-production-32";

  const dbHealth = await checkDatabaseHealth();
  const isHealthy =
    dbHealth.connected &&
    (process.env.NODE_ENV !== "production" ||
      (dbHealth.engine !== "in-memory" && dbHealth.engine !== "unconfigured"));

  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      service: "guardian-oasis",
      version: "1.0.0",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      checks: {
        sessionEngine: "active",
        database: {
          connected: dbHealth.connected,
          engine: dbHealth.engine,
          ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
          ...(dbHealth.error ? { error: "Database connectivity check failed" } : {}),
        },
        resendEmail: Boolean(process.env.RESEND_API_KEY) ? "configured" : "demo-mode",
        geminiAi: Boolean(process.env.GEMINI_API_KEY) ? "configured" : "demo-mode",
        cronWatchdog: Boolean(process.env.CRON_SECRET) ? "configured" : "demo-mode",
        productionSecurityGuard:
          process.env.NODE_ENV === "production" ? isSecretConfigured : "dev-permissive",
      },
    },
    { status: httpStatus }
  );
}
