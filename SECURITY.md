# 🔐 Guardian Oasis — Security Model

## Overview

Guardian Oasis is a hackathon prototype with a production-ready security mindset. The auth and data protection model is designed to be transparent to judges and straightforward to harden before a production deployment.

---

## Authentication Model

### iron-session (Encrypted Cookie)
All authenticated sessions use **iron-session** — a stateless, server-side encrypted cookie library. Session cookies are:
- **HttpOnly** — not accessible from JavaScript
- **Secure** — HTTPS-only in production (`NODE_ENV === "production"`)
- **24-hour expiry** (configurable)
- Encrypted with a 32+ character secret (`IRON_SESSION_SECRET`)

### Elder PIN (4-digit passcode)
The elder (`owner` role) authenticates via a 4-digit PIN stored in the `CareProfile` data. In production this would be bcrypt-hashed. The PIN is verified server-side via `POST /api/auth/elder-pin`.

### Circle Invite Code
Family members and caregivers join via a unique invite code (`circleInviteCode` on the profile, e.g. `OASIS-7629`). This prevents strangers from accessing a care circle without an explicit invitation link or code.

---

## Rate Limiting

Both auth endpoints (`/api/auth/elder-pin`, `/api/auth/circle-code`) implement simple **module-level rate limiting**:
- Max 5 attempts per IP per 15-minute window
- Returns `429 Too Many Requests` on excess
- Counter resets after the window expires

For production, use a Redis-backed rate limiter (e.g. `@upstash/ratelimit`) tied to the edge layer.

---

## Role-Based Access Control

| Role | Access Level |
|---|---|
| `owner` (Elder) | Elder Calm View, personal medication data |
| `family_manager` | Full dashboard, medication history, audit trail |
| `caregiver` | CareLoop inbox, task management, wellbeing check-in |
| `read_only` | View-only access (future) |

Route protection is enforced by `src/middleware.ts` — any request to a protected path without a valid session is redirected to the home page.

---

## Prescription Safety (MedSutra AI)

**Human verification is always required.** The Gemini AI provides:
- Plain-language explanations of prescriptions
- Drug interaction warnings (advisory only)
- Dosage clarifications

The UI enforces a mandatory "Confirm & Apply" step before any AI suggestion modifies the medication store. AI output is never applied automatically. This aligns with HIPAA-aware design principles.

---

## API Key Protection

| Key | Storage | Notes |
|---|---|---|
| `RESEND_API_KEY` | Server-side `.env.local` | Never exposed to the client |
| `GEMINI_API_KEY` | Server-side `.env.local` | Used only in API route handlers |
| `IRON_SESSION_SECRET` | Server-side `.env.local` | Min 32 chars, never logged |

All secrets are accessed via `process.env.*` in server-only code (API routes, server components). No secrets appear in `NEXT_PUBLIC_*` variables.

---

## Data Privacy (Wellbeing)

Caregiver wellbeing check-ins are stored in a **separate isolated store** (`wellbeingStore.ts`), not mixed with care coordination data. The `shareWithFamily` flag is explicitly opt-in and defaults to `false`. The UI displays a persistent consent notice: *"Your check-in is private unless you choose to share."*

---

## RLS / Database (Placeholder)

> When migrating from the in-memory store to a production database (e.g. Supabase/PostgreSQL), **Row-Level Security (RLS) policies** should be applied per `careProfileId` to ensure one care circle's data is never accessible to another. All queries from server-side API routes would include the authenticated `careProfileId` from the session.

---

## Production Hardening Checklist

- [ ] Replace 4-digit PIN with bcrypt-hashed passcode
- [ ] Add Supabase/PostgreSQL + RLS per `careProfileId`
- [ ] Replace module-level rate limiter with Redis (`@upstash/ratelimit`)
- [ ] Add CSRF protection (SameSite cookie + origin check)
- [ ] Enable HTTPS + HSTS in production
- [ ] Add structured audit logging for all auth events
- [ ] Rotate `IRON_SESSION_SECRET` on a schedule
- [ ] Add input sanitization middleware for all API routes
