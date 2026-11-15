import { NextResponse } from "next/server";
import { INITIAL_PROFILE } from "@/lib/store";
import { getSession } from "@/lib/session";
import { isDemoCredential, verifySecret, DEMO_CREDENTIALS } from "@/lib/authCrypto";
import { checkDistributedLoginRateLimit, resetLoginRateLimit } from "@/lib/rateLimit";
import { sanitizeRedirectUrl } from "@/lib/redirectSecurity";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("cf-connecting-ip") ||
      "unknown-client";

    const rateLimitKey = `elder-pin:${ip}`;
    const rateLimit = await checkDistributedLoginRateLimit(rateLimitKey, 5, 60_000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rateLimit.retryAfterSeconds || 60} seconds before retrying.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
          },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { pin, redirect } = body as { pin?: string; redirect?: string };

    if (!pin || typeof pin !== "string") {
      return NextResponse.json(
        { success: false, error: "4-digit passcode is required." },
        { status: 400 }
      );
    }

    // Reject hardcoded demo credentials in production environments
    if (process.env.NODE_ENV === "production" && isDemoCredential(pin)) {
      return NextResponse.json(
        {
          success: false,
          error: "Demo credentials are strictly prohibited in production.",
        },
        { status: 401 }
      );
    }

    // 1. Database-backed credential verification (Supabase)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data: creds, error: credErr } = await supabase
          .from("auth_credentials")
          .select("id, care_profile_id, care_member_id, credential_hash, credential_salt, role, revoked, expires_at")
          .eq("credential_type", "elder_pin")
          .eq("revoked", false);

        if (!credErr && creds && creds.length > 0) {
          const now = Date.now();
          for (const cred of creds) {
            if (cred.expires_at && new Date(cred.expires_at).getTime() < now) {
              continue;
            }

            const isMatch = verifySecret(pin, cred.credential_hash, cred.credential_salt);
            if (isMatch) {
              // Verify active member status
              const { data: member, error: memberErr } = await supabase
                .from("care_members")
                .select("id, name, status, role")
                .eq("id", cred.care_member_id)
                .single();

              if (memberErr || !member || member.status !== "ACTIVE") {
                return NextResponse.json(
                  { success: false, error: "Member account is inactive or revoked." },
                  { status: 401 }
                );
              }

              // Update last_used_at on credential
              await supabase
                .from("auth_credentials")
                .update({ last_used_at: new Date().toISOString() })
                .eq("id", cred.id);

              await resetLoginRateLimit(rateLimitKey);

              const session = await getSession();
              session.authenticated = true;
              session.role = "owner";
              session.profileId = cred.care_profile_id;
              session.memberId = cred.care_member_id;
              session.memberName = member.name;
              await session.save();

              const redirectUrl = sanitizeRedirectUrl(redirect, "owner");

              return NextResponse.json({
                success: true,
                role: "owner",
                memberName: member.name,
                memberId: cred.care_member_id,
                redirectUrl,
              });
            }
          }
        }
      }
    }

    // 2. Direct PostgreSQL fallback query
    try {
      const res = await query(
        `SELECT c.id, c.care_profile_id, c.care_member_id, c.credential_hash, c.credential_salt, c.role, c.expires_at, m.name as member_name, m.status as member_status
         FROM auth_credentials c
         JOIN care_members m ON c.care_member_id = m.id
         WHERE c.credential_type = 'elder_pin' AND c.revoked = false;`
      );

      if (res && res.rows.length > 0) {
        const now = Date.now();
        for (const row of res.rows) {
          if (row.expires_at && new Date(row.expires_at).getTime() < now) {
            continue;
          }

          if (row.member_status !== "ACTIVE") {
            continue;
          }

          const isMatch = verifySecret(pin, row.credential_hash, row.credential_salt);
          if (isMatch) {
            await query("UPDATE auth_credentials SET last_used_at = NOW() WHERE id = $1;", [row.id]);
            await resetLoginRateLimit(rateLimitKey);

            const session = await getSession();
            session.authenticated = true;
            session.role = "owner";
            session.profileId = row.care_profile_id;
            session.memberId = row.care_member_id;
            session.memberName = row.member_name;
            await session.save();

            const redirectUrl = sanitizeRedirectUrl(redirect, "owner");

            return NextResponse.json({
              success: true,
              role: "owner",
              memberName: row.member_name,
              memberId: row.care_member_id,
              redirectUrl,
            });
          }
        }
      }
    } catch {
      // Direct SQL check skipped if not configured
    }

    // In production, NEVER fall back to demo credentials
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Invalid credentials or account revoked." },
        { status: 401 }
      );
    }

    // 3. Development/Test Fallback
    const isDemoValid = verifySecret(
      pin,
      DEMO_CREDENTIALS.elderPin.hash,
      DEMO_CREDENTIALS.elderPin.salt
    );

    if (isDemoValid) {
      await resetLoginRateLimit(rateLimitKey);
      const session = await getSession();
      session.authenticated = true;
      session.role = "owner";
      session.profileId = INITIAL_PROFILE.id;
      session.memberId = "mem-eleanor";
      session.memberName = INITIAL_PROFILE.displayName;
      await session.save();

      const redirectUrl = sanitizeRedirectUrl(redirect, "owner");

      return NextResponse.json({
        success: true,
        role: "owner",
        memberName: INITIAL_PROFILE.displayName,
        memberId: "mem-eleanor",
        redirectUrl,
      });
    }

    return NextResponse.json(
      { success: false, error: "Incorrect PIN." },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Authentication system error. Please try again." },
      { status: 500 }
    );
  }
}
