-- =============================================================================
-- CareOrbit (Guardian Oasis) — Production Database Auth & Atomic RPC Functions
-- PromptWars x Catalyst Hackathon | Elder-First Connected Care Platform
-- =============================================================================

-- 1. Distributed Login Rate Limits Table
create table if not exists public.login_rate_limits (
    key text primary key,
    attempts integer default 1,
    first_attempt_at timestamptz default now(),
    last_attempt_at timestamptz default now(),
    locked_until timestamptz
);

-- 2. Production Database-Backed Credentials Table
create table if not exists public.auth_credentials (
    id uuid primary key default uuid_generate_v4(),
    care_profile_id uuid references public.care_profiles(id) on delete cascade not null,
    care_member_id uuid references public.care_members(id) on delete cascade not null,
    credential_type text not null check (credential_type in ('elder_pin', 'circle_invite')),
    credential_hash text not null,
    credential_salt text not null,
    role member_role not null,
    revoked boolean default false,
    expires_at timestamptz,
    last_used_at timestamptz,
    failed_attempts integer default 0,
    locked_until timestamptz,
    created_at timestamptz default now()
);

-- Partial index: only one active elder PIN per profile
create unique index if not exists idx_active_elder_pin
on public.auth_credentials(care_profile_id)
where credential_type = 'elder_pin' and revoked = false;

-- Operational indexes for auth verification
create index if not exists idx_auth_credentials_lookup
on public.auth_credentials(credential_type, revoked);

create index if not exists idx_auth_credentials_member
on public.auth_credentials(care_member_id);

create index if not exists idx_auth_credentials_profile
on public.auth_credentials(care_profile_id);

-- RLS: auth_credentials accessible ONLY to service role
alter table public.auth_credentials enable row level security;
alter table public.login_rate_limits enable row level security;

-- 3. Atomic Medication Creation RPC
create or replace function public.create_medication_atomically(
    p_profile_id uuid,
    p_name text,
    p_dosage text,
    p_instructions text,
    p_schedule_time text,
    p_slot text,
    p_pill_color text,
    p_pill_shape text,
    p_reason text,
    p_author_name text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_med_id uuid;
    v_version_id uuid;
    v_occ_id uuid;
    v_today date := current_date;
begin
    -- 1. Insert medication
    insert into public.medications (
        care_profile_id,
        name,
        dosage,
        instructions,
        pill_color,
        pill_shape,
        schedule_time,
        slot,
        current_version,
        remaining_quantity,
        refill_threshold,
        daily_frequency,
        active
    ) values (
        p_profile_id,
        p_name,
        p_dosage,
        p_instructions,
        p_pill_color,
        p_pill_shape,
        p_schedule_time,
        p_slot,
        1,
        30,
        7,
        1,
        true
    ) returning id into v_med_id;

    -- 2. Insert initial version
    insert into public.medication_versions (
        medication_id,
        version,
        label_name,
        dose_text,
        instructions,
        effective_from,
        created_by,
        reason
    ) values (
        v_med_id,
        1,
        p_name,
        p_dosage,
        p_instructions,
        v_today,
        p_author_name,
        p_reason
    ) returning id into v_version_id;

    -- 3. Insert initial scheduled dose occurrence
    insert into public.dose_occurrences (
        care_profile_id,
        medication_id,
        medication_name,
        dose_text,
        scheduled_for,
        scheduled_time_label,
        status,
        instructions
    ) values (
        p_profile_id,
        v_med_id,
        p_name,
        p_dosage,
        (v_today || 'T08:00:00Z')::timestamptz,
        p_schedule_time,
        'SCHEDULED',
        p_instructions
    ) returning id into v_occ_id;

    return jsonb_build_object(
        'success', true,
        'medicationId', v_med_id,
        'versionId', v_version_id,
        'occurrenceId', v_occ_id
    );
end;
$$;

-- 4. Atomic Medication Edit RPC
create or replace function public.edit_medication_atomically(
    p_medication_id uuid,
    p_dosage text,
    p_instructions text,
    p_schedule_time text,
    p_slot text,
    p_reason text,
    p_author_name text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_med record;
    v_new_version integer;
    v_version_id uuid;
begin
    select * into v_med from public.medications where id = p_medication_id and active = true for update;
    if not found then
        return jsonb_build_object('success', false, 'error', 'Medication not found');
    end if;

    v_new_version := coalesce(v_med.current_version, 1) + 1;

    update public.medications
    set dosage = coalesce(p_dosage, dosage),
        instructions = coalesce(p_instructions, instructions),
        schedule_time = coalesce(p_schedule_time, schedule_time),
        slot = coalesce(p_slot, slot),
        current_version = v_new_version
    where id = p_medication_id;

    insert into public.medication_versions (
        medication_id,
        version,
        label_name,
        dose_text,
        instructions,
        effective_from,
        created_by,
        reason
    ) values (
        p_medication_id,
        v_new_version,
        v_med.name,
        coalesce(p_dosage, v_med.dosage),
        coalesce(p_instructions, v_med.instructions),
        current_date,
        p_author_name,
        p_reason
    ) returning id into v_version_id;

    return jsonb_build_object(
        'success', true,
        'medicationId', p_medication_id,
        'newVersion', v_new_version,
        'versionId', v_version_id
    );
end;
$$;

-- 5. Atomic Dose Check-in RPC
create or replace function public.record_dose_checkin_atomically(
    p_occurrence_id uuid,
    p_status text,
    p_actor_name text,
    p_actor_role text,
    p_note text default null,
    p_do_not_notify_family boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_occ record;
    v_checkin_id uuid;
    v_now timestamptz := now();
begin
    select * into v_occ from public.dose_occurrences where id = p_occurrence_id for update;
    if not found then
        return jsonb_build_object('success', false, 'error', 'Occurrence not found');
    end if;

    update public.dose_occurrences
    set status = p_status::dose_state,
        updated_at = v_now,
        closed_at = case when p_status in ('MARKED_TAKEN', 'SKIPPED') then v_now else null end
    where id = p_occurrence_id;

    insert into public.dose_checkins (
        occurrence_id,
        status,
        actor_id,
        actor_name,
        actor_role,
        note,
        do_not_notify_family,
        recorded_at
    ) values (
        p_occurrence_id,
        p_status::dose_state,
        v_occ.care_profile_id,
        p_actor_name,
        p_actor_role,
        p_note,
        p_do_not_notify_family,
        v_now
    ) returning id into v_checkin_id;

    if p_status = 'MARKED_TAKEN' then
        update public.care_tasks
        set status = 'RESOLVED',
            resolution_outcome = 'self_resolved',
            resolution_note = 'Self-reported taken by ' || p_actor_name,
            resolved_at = v_now
        where source_occurrence_id = p_occurrence_id
          and status in ('OPEN', 'CLAIMED');
    end if;

    insert into public.audit_events (
        care_profile_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        occurred_at
    ) values (
        v_occ.care_profile_id,
        p_actor_name,
        p_actor_role,
        'DOSE_' || p_status,
        'DOSE',
        p_occurrence_id,
        p_actor_name || ' recorded status ''' || p_status || ''' for routine.' || coalesce(' Note: "' || p_note || '"', ''),
        v_now
    );

    return jsonb_build_object(
        'success', true,
        'occurrenceId', p_occurrence_id,
        'checkinId', v_checkin_id,
        'status', p_status
    );
end;
$$;
