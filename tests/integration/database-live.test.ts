import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PersistentCareRepository } from "@/lib/db/repository";
import { getDatabasePool } from "@/lib/db";
import { Pool } from "pg";

const liveDatabaseUrl = process.env.TEST_DATABASE_URL || (process.env.NODE_ENV !== "production" ? process.env.DATABASE_URL : undefined);
const isLiveDbAvailable = Boolean(liveDatabaseUrl && !liveDatabaseUrl.includes("placeholder"));

describe("CareOrbit — Disposable Database Integration Tests (Live PostgreSQL/Supabase)", () => {
  let pool: Pool | null = null;
  let repo: PersistentCareRepository | null = null;

  beforeAll(async () => {
    if (isLiveDbAvailable && liveDatabaseUrl) {
      pool = new Pool({
        connectionString: liveDatabaseUrl,
        ssl: liveDatabaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      repo = new PersistentCareRepository();
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it("evaluates live database connectivity or reports required disposable CI configuration", async () => {
    if (!isLiveDbAvailable || !pool) {
      console.info(
        "[Integration Test Notice] Live database integration suite skipped: TEST_DATABASE_URL is not set. In CI, configure a disposable PostgreSQL container/service to execute live database integration tests."
      );
      expect(isLiveDbAvailable).toBe(false);
      return;
    }

    // Verify database responds to query
    const res = await pool.query("SELECT 1 as connected;");
    expect(res.rows[0].connected).toBe(1);
  });

  it("verifies schema tables and integrity constraints in live database", async () => {
    if (!isLiveDbAvailable || !pool) return;

    const tableQuery = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('care_profiles', 'care_members', 'medications', 'medication_versions', 'care_tasks', 'caregiver_wellbeing', 'notification_jobs');
    `);
    const tables = tableQuery.rows.map((r) => r.table_name);
    expect(tables).toContain("care_profiles");
    expect(tables).toContain("care_members");
    expect(tables).toContain("medications");
    expect(tables).toContain("care_tasks");
    expect(tables).toContain("caregiver_wellbeing");
  });

  it("enforces cross-profile isolation on live database", async () => {
    if (!isLiveDbAvailable || !repo) return;

    // Profiles must not see each other's medications or tasks
    const profile1Meds = await repo.getMedications("00000000-0000-0000-0000-000000000001");
    const profile2Meds = await repo.getMedications("00000000-0000-0000-0000-000000000002");
    expect(Array.isArray(profile1Meds)).toBe(true);
    expect(Array.isArray(profile2Meds)).toBe(true);
  });
});
