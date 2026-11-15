-- =============================================================================
-- CareOrbit (Guardian Oasis) — Atomic Escalation, Idempotency & Partial Indexes
-- PromptWars x Catalyst Hackathon | Elder-First Connected Care Platform
-- =============================================================================

-- 1. Ensure silent_routine column exists on dose_occurrences
alter table public.dose_occurrences
    add column if not exists silent_routine boolean default false;

-- 2. Partial unique index: Guarantee at most ONE active (OPEN or CLAIMED) task per dose occurrence
-- Prevents race conditions during concurrent Cloud Run or cron-watchdog executions
create unique index if not exists idx_care_tasks_active_source_occ
on public.care_tasks(source_occurrence_id)
where status in ('OPEN', 'CLAIMED') and source_occurrence_id is not null;

-- 3. Partial unique index: Guarantee at most ONE active backup relief request per care profile
create unique index if not exists idx_care_tasks_active_backup
on public.care_tasks(care_profile_id)
where medication_name = 'Caregiver Relief Coverage' and status in ('OPEN', 'CLAIMED');

-- 4. Atomic escalation function in PostgreSQL
create or replace function public.escalate_dose_atomically(
    p_occurrence_id uuid,
    p_profile_id uuid,
    p_med_name text,
    p_dose_text text,
    p_scheduled_time text,
    p_assigned_name text,
    p_assigned_email text,
    p_grace_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_existing_id uuid;
    v_new_task_id uuid;
    v_task_row record;
begin
    -- 1. Check if an active task already exists for this occurrence
    select id into v_existing_id
    from public.care_tasks
    where source_occurrence_id = p_occurrence_id
      and status in ('OPEN', 'CLAIMED')
    limit 1;

    if v_existing_id is not null then
        return jsonb_build_object(
            'created', false,
            'reason', 'ACTIVE_TASK_EXISTS',
            'taskId', v_existing_id
        );
    end if;

    -- 2. Update occurrence status to UNCONFIRMED
    update public.dose_occurrences
    set status = 'UNCONFIRMED',
        updated_at = now()
    where id = p_occurrence_id;

    -- 3. Atomically create the escalation task
    insert into public.care_tasks (
        care_profile_id,
        source_occurrence_id,
        medication_name,
        dose_text,
        scheduled_time,
        grace_minutes_expired,
        assigned_to_name,
        assigned_to_email,
        status,
        priority
    ) values (
        p_profile_id,
        p_occurrence_id,
        p_med_name,
        p_dose_text,
        p_scheduled_time,
        p_grace_minutes,
        p_assigned_name,
        p_assigned_email,
        'OPEN',
        'HIGH'
    )
    returning * into v_task_row;

    return jsonb_build_object(
        'created', true,
        'taskId', v_task_row.id,
        'status', v_task_row.status
    );
exception
    when unique_violation then
        -- Concurrency race won by another worker
        return jsonb_build_object(
            'created', false,
            'reason', 'CONCURRENT_INSERT_HANDLED'
        );
end;
$$;
