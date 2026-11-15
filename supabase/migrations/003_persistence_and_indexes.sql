-- =============================================================================
-- CareOrbit (Guardian Oasis) — Schema Hardening, Indexes & Referential Integrity
-- PromptWars x Catalyst Hackathon | Elder-First Connected Care Platform
-- =============================================================================

-- 1. Enhance care_profiles
alter table public.care_profiles
    add column if not exists locale text default 'en',
    add column if not exists notes text[] default '{}';

-- 2. Enhance medications
alter table public.medications
    add column if not exists daily_frequency integer default 1,
    add column if not exists food_requirement text default 'With food',
    add column if not exists prescribed_by text default 'Dr. Robert Vance';

-- 3. Enhance dose_occurrences with denormalized routine details & ISO timestamp
alter table public.dose_occurrences
    add column if not exists care_profile_id uuid references public.care_profiles(id) on delete cascade,
    add column if not exists medication_name text,
    add column if not exists dose_text text,
    add column if not exists scheduled_iso text,
    add column if not exists instructions text;

-- 4. Enhance dose_checkins
alter table public.dose_checkins
    add column if not exists do_not_notify_family boolean default false;

-- 5. Enhance care_tasks
alter table public.care_tasks
    add column if not exists assigned_to_role text default 'caregiver',
    add column if not exists handed_off_to text;

-- 6. Enhance notification_jobs
alter table public.notification_jobs
    add column if not exists care_profile_id uuid references public.care_profiles(id) on delete set null,
    add column if not exists retry_count integer default 0,
    add column if not exists provider_error text,
    add column if not exists provider_message_id text;

-- =============================================================================
-- PERFORMANCE & INTEGRITY INDEXES
-- =============================================================================

-- Tenant & Patient lookup indexes
create index if not exists idx_care_members_profile on public.care_members(care_profile_id);
create index if not exists idx_medications_profile on public.medications(care_profile_id);
create index if not exists idx_dose_occurrences_profile on public.dose_occurrences(care_profile_id);
create index if not exists idx_appointments_profile on public.appointments(care_profile_id);
create index if not exists idx_care_tasks_profile on public.care_tasks(care_profile_id);
create index if not exists idx_audit_events_profile on public.audit_events(care_profile_id);
create index if not exists idx_wellbeing_profile on public.caregiver_wellbeing(care_profile_id);

-- Operational indexes for CareLoop Watchdog & Real-Time Escalation
create index if not exists idx_dose_occurrences_status on public.dose_occurrences(status);
create index if not exists idx_dose_occurrences_scheduled on public.dose_occurrences(scheduled_for);
create index if not exists idx_care_tasks_status on public.care_tasks(status);
create index if not exists idx_care_tasks_source_occ on public.care_tasks(source_occurrence_id);
create index if not exists idx_appointments_starts_at on public.appointments(starts_at);
create index if not exists idx_notification_jobs_dedupe on public.notification_jobs(dedupe_key);
