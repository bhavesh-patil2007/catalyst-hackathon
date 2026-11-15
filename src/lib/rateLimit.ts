import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getDatabasePool, query } from "@/lib/db";

const inMemoryRateLimits = new Map<
  string,
  { attempts: number; firstAttemptAt: number; lockedUntil?: number }
>();

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

/**
 * Distributed Login Rate Limiter.
 * Uses PostgreSQL/Supabase `login_rate_limits` table when persistent database is configured,
 * with graceful in-memory fallback for isolated unit test environments.
 */
export async function checkDistributedLoginRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // 1. Supabase-backed rate limiting
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data: record, error: fetchErr } = await supabase
          .from("login_rate_limits")
          .select("key, attempts, first_attempt_at, last_attempt_at, locked_until")
          .eq("key", key)
          .maybeSingle();

        if (!fetchErr && record) {
          if (record.locked_until && new Date(record.locked_until).getTime() > now) {
            const retryAfterSeconds = Math.ceil(
              (new Date(record.locked_until).getTime() - now) / 1000
            );
            return {
              allowed: false,
              remainingAttempts: 0,
              retryAfterSeconds,
            };
          }

          const firstAttemptTime = new Date(record.first_attempt_at).getTime();
          if (now - firstAttemptTime > windowMs) {
            // Window expired, reset counter
            await supabase
              .from("login_rate_limits")
              .update({
                attempts: 1,
                first_attempt_at: nowIso,
                last_attempt_at: nowIso,
                locked_until: null,
              })
              .eq("key", key);

            return { allowed: true, remainingAttempts: maxAttempts - 1 };
          }

          if (record.attempts >= maxAttempts) {
            const lockedUntil = new Date(now + windowMs).toISOString();
            await supabase
              .from("login_rate_limits")
              .update({
                locked_until: lockedUntil,
                last_attempt_at: nowIso,
              })
              .eq("key", key);

            return {
              allowed: false,
              remainingAttempts: 0,
              retryAfterSeconds: Math.ceil(windowMs / 1000),
            };
          }

          const newAttempts = record.attempts + 1;
          await supabase
            .from("login_rate_limits")
            .update({
              attempts: newAttempts,
              last_attempt_at: nowIso,
            })
            .eq("key", key);

          return {
            allowed: true,
            remainingAttempts: Math.max(0, maxAttempts - newAttempts),
          };
        }

        // Insert new limit tracking record
        await supabase.from("login_rate_limits").insert({
          key,
          attempts: 1,
          first_attempt_at: nowIso,
          last_attempt_at: nowIso,
        });

        return { allowed: true, remainingAttempts: maxAttempts - 1 };
      }
    } catch (err) {
      console.warn("[RateLimit] Supabase query failed, falling back to local rate limiter:", err);
    }
  }

  // 2. Direct PostgreSQL fallback
  if (getDatabasePool()) {
    try {
      const res = await query(
        "SELECT key, attempts, first_attempt_at, last_attempt_at, locked_until FROM login_rate_limits WHERE key = $1;",
        [key]
      );

      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        if (row.locked_until && new Date(row.locked_until).getTime() > now) {
          return {
            allowed: false,
            remainingAttempts: 0,
            retryAfterSeconds: Math.ceil((new Date(row.locked_until).getTime() - now) / 1000),
          };
        }

        const firstAttempt = new Date(row.first_attempt_at).getTime();
        if (now - firstAttempt > windowMs) {
          await query(
            "UPDATE login_rate_limits SET attempts = 1, first_attempt_at = $1, last_attempt_at = $1, locked_until = NULL WHERE key = $2;",
            [nowIso, key]
          );
          return { allowed: true, remainingAttempts: maxAttempts - 1 };
        }

        if (row.attempts >= maxAttempts) {
          const lockedUntil = new Date(now + windowMs).toISOString();
          await query(
            "UPDATE login_rate_limits SET locked_until = $1, last_attempt_at = $2 WHERE key = $3;",
            [lockedUntil, nowIso, key]
          );
          return {
            allowed: false,
            remainingAttempts: 0,
            retryAfterSeconds: Math.ceil(windowMs / 1000),
          };
        }

        const newAttempts = row.attempts + 1;
        await query(
          "UPDATE login_rate_limits SET attempts = $1, last_attempt_at = $2 WHERE key = $3;",
          [newAttempts, nowIso, key]
        );
        return { allowed: true, remainingAttempts: Math.max(0, maxAttempts - newAttempts) };
      }

      await query(
        "INSERT INTO login_rate_limits (key, attempts, first_attempt_at, last_attempt_at) VALUES ($1, 1, $2, $2) ON CONFLICT (key) DO NOTHING;",
        [key, nowIso]
      );
      return { allowed: true, remainingAttempts: maxAttempts - 1 };
    } catch {
      // Database query failed or unconfigured, fallback to in-memory map
    }
  }

  // 3. In-memory limiter (isolated test environments)
  const entry = inMemoryRateLimits.get(key);
  if (!entry || now - entry.firstAttemptAt > windowMs) {
    inMemoryRateLimits.set(key, { attempts: 1, firstAttemptAt: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = now + windowMs;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  entry.attempts += 1;
  return {
    allowed: true,
    remainingAttempts: Math.max(0, maxAttempts - entry.attempts),
  };
}

/**
 * Resets rate limit records on successful authentication.
 */
export async function resetLoginRateLimit(key: string): Promise<void> {
  inMemoryRateLimits.delete(key);

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        await supabase.from("login_rate_limits").delete().eq("key", key);
      }
    } catch {
      // ignore
    }
  }

  if (getDatabasePool()) {
    try {
      await query("DELETE FROM login_rate_limits WHERE key = $1;", [key]);
    } catch {
      // ignore
    }
  }
}
