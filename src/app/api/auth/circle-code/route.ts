import { NextResponse } from "next/server";
import { INITIAL_PROFILE } from "@/lib/store";
import { getSession } from "@/lib/session";
import { isDemoCredential, verifyCircleInvitation, verifySecret } from "@/lib/authCrypto";
import { checkDistributedLoginRateLimit, resetLoginRateLimit } from "@/lib/rateLimit";
import { sanitizeRedirectUrl } from "@/lib/redirectSecurity";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { query } from "@/lib/db";
import { UserRole } from "@/types";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("cf-connecting-ip") ||
      "unknown-client";

    const rateLimitKey = `circle-code:${ip}`;
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
    const { code, redirect } = body as { code?: string; redirect?: string };

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "Circle invitation code is required." },
        { status: 400 }
      );
    }

    // In production, reject known demo codes
    if (process.env.NODE_ENV === "production" && isDemoCredential(code)) {
      return NextResponse.json(
        {
          success: false,
          error: "Demo invite codes are strictly prohibited in production.",
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
          .eq("credential_type", "circle_invite")
          .eq("revoked", false);

        if (!credErr && creds && creds.length > 0) {
          const now = Date.now();
          for (const cred of creds) {
            if (cred.expires_at && new Date(cred.expires_at).getTime() < now) {
              continue;
            }

            const isMatch = verifySecret(code, cred.credential_hash, cred.credential_salt);
            if (isMatch) {
              // Verify active member status and derive authoritative identity
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

              const assignedRole = cred.role as UserRole;
              const session = await getSession();
              session.authenticated = true;
              session.role = assignedRole;
              session.profileId = cred.care_profile_id;
              session.memberId = cred.care_member_id;
              session.memberName = member.name;
              await session.save();

              const redirectUrl = sanitizeRedirectUrl(redirect, assignedRole);

              return NextResponse.json({
                success: true,
                role: assignedRole,
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
         WHERE c.credential_type = 'circle_invite' AND c.revoked = false;`
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

          const isMatch = verifySecret(code, row.credential_hash, row.credential_salt);
          if (isMatch) {
            await query("UPDATE auth_credentials SET last_used_at = NOW() WHERE id = $1;", [row.id]);
            await resetLoginRateLimit(rateLimitKey);

            const assignedRole = row.role as UserRole;
            const session = await getSession();
            session.authenticated = true;
            session.role = assignedRole;
            session.profileId = row.care_profile_id;
            session.memberId = row.care_member_id;
            session.memberName = row.member_name;
            await session.save();

            const redirectUrl = sanitizeRedirectUrl(redirect, assignedRole);

            return NextResponse.json({
              success: true,
              role: assignedRole,
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
        { success: false, error: "Invalid invitation code or member access revoked." },
        { status: 401 }
      );
    }

    // 3. Development/Test Fallback
    const verification = verifyCircleInvitation(code);

    if (verification.valid && verification.role) {
      await resetLoginRateLimit(rateLimitKey);

      const assignedRole = verification.role;
      const defaultName =
        assignedRole === "caregiver"
          ? "Priya Sharma, RN"
          : assignedRole === "read_only"
          ? "Care Circle Observer"
          : "Sarah Thompson";

      const defaultMemberId =
        assignedRole === "caregiver"
          ? "mem-priya"
          : assignedRole === "read_only"
          ? "mem-observer"
          : "mem-sarah";

      const session = await getSession();
      session.authenticated = true;
      session.role = assignedRole;
      session.profileId = INITIAL_PROFILE.id;
      session.memberId = defaultMemberId;
      session.memberName = defaultName;
      await session.save();

      const redirectUrl = sanitizeRedirectUrl(redirect, assignedRole);

      return NextResponse.json({
        success: true,
        role: assignedRole,
        memberName: defaultName,
        memberId: defaultMemberId,
        redirectUrl,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid or expired circle invitation code." },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Authentication system error. Please try again." },
      { status: 500 }
    );
  }
}
