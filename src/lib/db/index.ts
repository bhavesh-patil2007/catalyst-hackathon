import { Pool, QueryResult, QueryResultRow } from "pg";

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
  engine: "postgresql" | "in-memory";
  error?: string;
}> {
  const p = getDatabasePool();
  if (!p) {
    return {
      connected: true,
      engine: "in-memory",
    };
  }

  const start = Date.now();
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
      engine: "postgresql",
      error: err?.message || "Database health check query failed",
    };
  }
}
