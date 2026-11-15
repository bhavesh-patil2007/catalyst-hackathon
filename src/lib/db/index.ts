import "server-only";
import { Pool, QueryResult, QueryResultRow } from "pg";
import { getSupabaseServerClient, isSupabaseConfigured } from "../supabase/server";

let pool: Pool | null = null;

export function getDatabasePool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("[PostgreSQL] Unexpected error on idle client", err);
    });
  }

  return pool;
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R> | null> {
  const p = getDatabasePool();
  if (!p) {
    return null;
  }
  return p.query<R>(text, params);
}

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
  engine: "supabase" | "postgresql" | "in-memory" | "unconfigured";
  error?: string;
}> {
  const start = Date.now();

  // 1. Supabase Check (Primary production client)
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return {
          connected: false,
          engine: "supabase",
          error: "Supabase client initialization failed",
        };
      }
      const { error } = await supabase
        .from("care_profiles")
        .select("id", { count: "exact", head: true });

      if (error) {
        return {
          connected: false,
          latencyMs: Date.now() - start,
          engine: "supabase",
          error: process.env.NODE_ENV === "production" ? "Database connectivity check failed" : error.message,
        };
      }

      return {
        connected: true,
        latencyMs: Date.now() - start,
        engine: "supabase",
      };
    } catch (err: any) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        engine: "supabase",
        error: process.env.NODE_ENV === "production" ? "Database connectivity check failed" : err?.message,
      };
    }
  }

  // 2. Direct PostgreSQL Check (if DATABASE_URL is configured)
  const p = getDatabasePool();
  if (p) {
    try {
      await p.query("SELECT 1;");
      return {
        connected: true,
        latencyMs: Date.now() - start,
        engine: "postgresql",
      };
    } catch (err: any) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        engine: "postgresql",
        error: process.env.NODE_ENV === "production" ? "Database connectivity check failed" : err?.message,
      };
    }
  }

  // 3. Fallback: In-memory mode (permitted only in development and test)
  if (process.env.NODE_ENV === "production") {
    return {
      connected: false,
      engine: "unconfigured",
      error: "No persistent database configured. SUPABASE_URL or DATABASE_URL required in production.",
    };
  }

  return {
    connected: true,
    engine: "in-memory",
  };
}
