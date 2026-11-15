-- =============================================================================
-- CareOrbit (Guardian Oasis) — Caregiver Wellbeing Schema & RLS Policies
-- PromptWars x Catalyst Hackathon | Elder-First Connected Care Platform
-- =============================================================================

create table if not exists public.caregiver_wellbeing (
    id uuid primary key default uuid_generate_v4(),
    care_profile_id uuid references public.care_profiles(id) on delete cascade not null,
    caregiver_id text not null,
    sleep_hours numeric not null check (sleep_hours >= 0 and sleep_hours <= 12),
    mood integer not null check (mood >= 1 and mood <= 5),
    stress integer not null check (stress >= 1 and stress <= 5),
    energy integer not null check (energy >= 1 and energy <= 5),
    note text,
    share_with_family boolean default false,
    recorded_at timestamptz default now()
);

alter table public.caregiver_wellbeing enable row level security;

-- Caregivers can view their own wellbeing check-ins
create policy "Caregivers can view own wellbeing checkins"
on public.caregiver_wellbeing for select
using (
    caregiver_id = auth.jwt() ->> 'email'
    or caregiver_id = auth.jwt() ->> 'name'
);

-- Family managers can only view entries where share_with_family is true
create policy "Family managers can only view shared wellbeing checkins"
on public.caregiver_wellbeing for select
using (
    share_with_family = true
    and exists (
        select 1 from public.care_members
        where care_profile_id = caregiver_wellbeing.care_profile_id
        and user_id = auth.uid()
        and role in ('owner', 'family_manager')
    )
);

-- Only authenticated caregivers can record check-ins
create policy "Caregivers can record wellbeing checkins"
on public.caregiver_wellbeing for insert
with check (
    exists (
        select 1 from public.care_members
        where care_profile_id = caregiver_wellbeing.care_profile_id
        and user_id = auth.uid()
        and role in ('caregiver', 'family_manager')
    )
);
