-- =============================================================================
-- CareOrbit (Guardian Oasis) — Supabase PostgreSQL Schema & RLS Policies
-- PromptWars x Catalyst Hackathon | Elder-First Connected Care Platform
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. care_profiles
create table if not exists public.care_profiles (
    id uuid primary key default uuid_generate_v4(),
    owner_user_id uuid not null,
    display_name text not null,
    age integer not null,
    initials text not null,
    conditions text[] default '{}',
    vital_notes text[] default '{}',
    passcode_hash text not null,
    household_code text not null unique,
    timezone text default 'America/New_York',
    created_at timestamptz default now()
);

-- 2. care_members
create type member_role as enum ('owner', 'family_manager', 'caregiver', 'read_only');
create table if not exists public.care_members (
    id uuid primary key default uuid_generate_v4(),
    care_profile_id uuid references public.care_profiles(id) on delete cascade not null,
    user_id uuid not null,
    name text not null,
    email text not null,
    role member_role not null default 'family_manager',
    relationship text not null,
    phone text,
    is_primary_caregiver boolean default false,
    status text default 'ACTIVE',
    created_at timestamptz default now()
);

-- 3. medications
create table if not exists public.medications (
    id uuid primary key default uuid_generate_v4(),
    care_profile_id uuid references public.care_profiles(id) on delete cascade not null,
    name text not null,
    dosage text not null,
    instructions text not null,
    pill_color text default 'emerald',
    pill_shape text default 'capsule',
    active boolean default true,
    current_version integer default 1,
    remaining_quantity integer default 30,
    refill_threshold integer default 7,
    schedule_time text not null,
    slot text not null,
    created_at timestamptz default now()
);

-- 4. medication_versions (Immutable schedule & instruction audit)
create table if not exists public.medication_versions (
    id uuid primary key default uuid_generate_v4(),
    medication_id uuid references public.medications(id) on delete cascade not null,
    version integer not null,
    label_name text not null,
    dose_text text not null,
    instructions text not null,
    effective_from date not null,
    created_by text not null,
    reason text not null,
    confirmed_by text,
    created_at timestamptz default now()
);

-- 5. dose_occurrences
create type dose_state as enum (
    'SCHEDULED', 'PENDING', 'SNOOZED', 'MARKED_TAKEN',
    'SKIPPED', 'NEEDS_HELP', 'UNCONFIRMED', 'RESOLVED'
);

create table if not exists public.dose_occurrences (
    id uuid primary key default uuid_generate_v4(),
    medication_id uuid references public.medications(id) on delete cascade not null,
    scheduled_for timestamptz not null,
    scheduled_time_label text not null,
    status dose_state default 'SCHEDULED',
    updated_at timestamptz default now(),
    closed_at timestamptz
);

-- 6. dose_checkins
create table if not exists public.dose_checkins (
    id uuid primary key default uuid_generate_v4(),
    occurrence_id uuid references public.dose_occurrences(id) on delete cascade not null,
    status dose_state not null,
    actor_id uuid not null,
    actor_name text not null,
    actor_role text not null,
    recorded_at timestamptz default now(),
    note text
);

-- 7. appointments
create table if not exists public.appointments (
    id uuid primary key default uuid_generate_v4(),
    care_profile_id uuid references public.care_profiles(id) on delete cascade not null,
    doctor_name text not null,
    specialty text not null,
    clinic_name text not null,
    address text not null,
    starts_at timestamptz not null,
    date_label text not null,
    time_label text not null,
    transport_assigned boolean default false,
    transport_details text,
    questions_to_ask text[] default '{}',
    post_visit_notes text,
    status text default 'UPCOMING',
    created_at timestamptz default now()
);

-- 8. care_tasks (CareLoop escalation & handoffs)
create type task_status as enum ('OPEN', 'CLAIMED', 'RESOLVED');
create table if not exists public.care_tasks (
    id uuid primary key default uuid_generate_v4(),
    care_profile_id uuid references public.care_profiles(id) on delete cascade not null,
    source_occurrence_id uuid references public.dose_occurrences(id) on delete set null,
    medication_name text not null,
    dose_text text not null,
    scheduled_time text not null,
    grace_minutes_expired integer not null default 30,
    assigned_to_name text not null,
    assigned_to_email text not null,
    status task_status default 'OPEN',
    claimed_by text,
    claimed_at timestamptz,
    resolution_outcome text,
    resolution_note text,
    resolved_at timestamptz,
    priority text default 'HIGH',
    created_at timestamptz default now()
);

-- 9. notification_jobs (Deduplicated proactive notifications)
create table if not exists public.notification_jobs (
    id uuid primary key default uuid_generate_v4(),
    dedupe_key text not null unique,
    recipient_email text not null,
    recipient_role text not null,
    notification_type text not null,
    subject text not null,
    body_preview text not null,
    status text default 'DELIVERED',
    sent_at timestamptz default now()
);

-- 10. audit_events (Append-only tamper-resistant care log)
create table if not exists public.audit_events (
    id uuid primary key default uuid_generate_v4(),
    care_profile_id uuid references public.care_profiles(id) on delete cascade not null,
    actor_name text not null,
    actor_role text not null,
    action text not null,
    entity_type text not null,
    entity_id text not null,
    description text not null,
    occurred_at timestamptz default now()
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

alter table public.care_profiles enable row level security;
alter table public.care_members enable row level security;
alter table public.medications enable row level security;
alter table public.medication_versions enable row level security;
alter table public.dose_occurrences enable row level security;
alter table public.dose_checkins enable row level security;
alter table public.appointments enable row level security;
alter table public.care_tasks enable row level security;
alter table public.audit_events enable row level security;

-- Care Profile Access: Only authorized members can view
create policy "Care profile accessible only to registered circle members"
on public.care_profiles for select
using (
    id in (
        select care_profile_id from public.care_members
        where user_id = auth.uid()
    )
);

-- Read-only role cannot mutate medication data
create policy "Read-only members cannot insert or update medications"
on public.medications for insert
with check (
    exists (
        select 1 from public.care_members
        where care_profile_id = medications.care_profile_id
        and user_id = auth.uid()
        and role in ('owner', 'family_manager')
    )
);

-- CareLoop task claims restricted to authorized caregivers & family managers
create policy "Caregivers can claim and resolve tasks"
on public.care_tasks for update
using (
    exists (
        select 1 from public.care_members
        where care_profile_id = care_tasks.care_profile_id
        and user_id = auth.uid()
        and role in ('caregiver', 'family_manager', 'owner')
    )
);

-- Audit events are strictly append-only
create policy "Audit events are append only and immutable"
on public.audit_events for insert
with check (true);
