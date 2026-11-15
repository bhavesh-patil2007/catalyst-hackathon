-- =============================================================================
-- CareOrbit (Guardian Oasis) — Migration 006: Wellbeing, Outbox & Ownership
-- PromptWars x Catalyst Hackathon | Elder-First Connected Care Platform
-- =============================================================================

-- 1. CAREGIVER WELLBEING: Daily Constraint & Stable Identity
alter table public.caregiver_wellbeing
    add column if not exists checkin_date date default current_date;

-- Guarantee at most ONE check-in per caregiver per care profile per calendar day
create unique index if not exists idx_unique_caregiver_daily_checkin
on public.caregiver_wellbeing (care_profile_id, caregiver_id, checkin_date);

-- 2. CARE TASKS: Concurrency-Safe Ownership & Handoff History
alter table public.care_tasks
    add column if not exists assigned_caregiver_id text,
    add column if not exists claim_timestamp timestamptz,
    add column if not exists handoff_history jsonb default '[]'::jsonb;

-- Guarantee at most ONE active backup relief request per care profile
create unique index if not exists idx_unique_active_backup_request
on public.care_tasks(care_profile_id)
where (source_occurrence_id = 'backup-caregiver' or medication_name = 'Caregiver Relief Coverage')
  and status in ('OPEN', 'CLAIMED');

-- Guarantee at most ONE active escalation task per source dose occurrence
create unique index if not exists idx_unique_active_escalation_task
on public.care_tasks(source_occurrence_id)
where source_occurrence_id is not null
  and status in ('OPEN', 'CLAIMED');

-- 3. NOTIFICATION JOBS: Durable Outbox & Webhook Delivery Tracking
alter table public.notification_jobs
    add column if not exists care_profile_id uuid references public.care_profiles(id) on delete cascade,
    add column if not exists provider_message_id text,
    add column if not exists processing_started_at timestamptz,
    add column if not exists delivered_at timestamptz;

create unique index if not exists idx_notification_jobs_dedupe_key
on public.notification_jobs(dedupe_key);

create index if not exists idx_notification_jobs_provider_msg
on public.notification_jobs(provider_message_id);

-- 4. ATOMIC RPC: Task Claiming with Concurrency Guard
create or replace function public.claim_task_atomically(
    p_task_id uuid,
    p_claimer_name text,
    p_claimer_member_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_task record;
begin
    -- Conditional atomic update: only transitions from OPEN
    update public.care_tasks
    set status = 'CLAIMED',
        claimed_by = p_claimer_name,
        assigned_caregiver_id = p_claimer_member_id,
        claimed_at = now(),
        claim_timestamp = now()
    where id = p_task_id
      and status = 'OPEN'
    returning * into v_task;

    if not found then
        -- Check if task exists with another status
        select status into v_task from public.care_tasks where id = p_task_id;
        if not found then
            return jsonb_build_object('success', false, 'error', 'NOT_FOUND');
        else
            return jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED_OR_RESOLVED', 'status', v_task.status);
        end if;
    end if;

    -- Audit log
    insert into public.audit_events (
        care_profile_id, actor_name, actor_role, action, entity_type, entity_id, description
    ) values (
        v_task.care_profile_id, p_claimer_name, 'caregiver', 'TASK_CLAIMED', 'TASK',
        p_task_id, format('%s claimed ownership of task #%s', p_claimer_name, p_task_id)
    );

    return jsonb_build_object('success', true, 'task', to_jsonb(v_task));
end;
$$;

-- 5. ATOMIC RPC: Task Handoff with Immutable Handoff Log
create or replace function public.handoff_task_atomically(
    p_task_id uuid,
    p_from_name text,
    p_to_name text,
    p_note text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_task record;
    v_history_entry jsonb;
begin
    v_history_entry := jsonb_build_object(
        'from', p_from_name,
        'to', p_to_name,
        'note', p_note,
        'timestamp', now()
    );

    update public.care_tasks
    set assigned_to_name = p_to_name,
        handed_off_to = p_to_name,
        status = 'CLAIMED',
        resolution_note = format('Handoff from %s to %s: "%s"', p_from_name, p_to_name, p_note),
        handoff_history = coalesce(handoff_history, '[]'::jsonb) || jsonb_build_array(v_history_entry)
    where id = p_task_id
      and status in ('OPEN', 'CLAIMED')
    returning * into v_task;

    if not found then
        return jsonb_build_object('success', false, 'error', 'TASK_NOT_FOUND_OR_RESOLVED');
    end if;

    insert into public.audit_events (
        care_profile_id, actor_name, actor_role, action, entity_type, entity_id, description
    ) values (
        v_task.care_profile_id, p_from_name, 'caregiver', 'TASK_HANDOFF', 'TASK',
        p_task_id, format('%s handed off task #%s to %s. Note: "%s"', p_from_name, p_task_id, p_to_name, p_note)
    );

    return jsonb_build_object('success', true, 'task', to_jsonb(v_task));
end;
$$;

-- 6. ATOMIC RPC: Task Resolution
create or replace function public.resolve_task_atomically(
    p_task_id uuid,
    p_outcome text,
    p_note text,
    p_resolver_name text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_task record;
begin
    update public.care_tasks
    set status = 'RESOLVED',
        resolution_outcome = p_outcome,
        resolution_note = p_note,
        resolved_at = now()
    where id = p_task_id
      and status in ('OPEN', 'CLAIMED')
    returning * into v_task;

    if not found then
        return jsonb_build_object('success', false, 'error', 'TASK_ALREADY_RESOLVED_OR_NOT_FOUND');
    end if;

    insert into public.audit_events (
        care_profile_id, actor_name, actor_role, action, entity_type, entity_id, description
    ) values (
        v_task.care_profile_id, p_resolver_name, 'caregiver', 'TASK_RESOLVED', 'TASK',
        p_task_id, format('%s resolved task #%s. Outcome: %s. Note: "%s"', p_resolver_name, p_task_id, p_outcome, p_note)
    );

    return jsonb_build_object('success', true, 'task', to_jsonb(v_task));
end;
$$;

-- 7. ATOMIC RPC: Durable Notification Outbox Reservation
create or replace function public.reserve_notification_job(
    p_dedupe_key text,
    p_profile_id uuid,
    p_recipient_email text,
    p_recipient_role text,
    p_type text,
    p_subject text,
    p_body_preview text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_job record;
    v_new_id uuid;
begin
    -- 1. Try to find existing record
    select * into v_job from public.notification_jobs where dedupe_key = p_dedupe_key limit 1;

    if v_job is not null then
        -- Already dispatched or delivered: suppress duplicate send
        if v_job.status in ('ACCEPTED', 'DELIVERED') then
            return jsonb_build_object('dispatched', false, 'status', 'SUPPRESSED', 'jobId', v_job.id);
        end if;

        -- If in PROCESSING, another instance is actively handling it
        if v_job.status = 'PROCESSING' and v_job.processing_started_at > now() - interval '2 minutes' then
            return jsonb_build_object('dispatched', false, 'status', 'SUPPRESSED', 'jobId', v_job.id);
        end if;

        -- Can be retried (PENDING or FAILED or timed-out PROCESSING)
        update public.notification_jobs
        set status = 'PROCESSING',
            processing_started_at = now(),
            retry_count = coalesce(retry_count, 0) + 1
        where id = v_job.id
        returning * into v_job;

        return jsonb_build_object('dispatched', true, 'status', 'RESERVED', 'jobId', v_job.id);
    end if;

    -- 2. Insert new job in PROCESSING state
    v_new_id := uuid_generate_v4();
    insert into public.notification_jobs (
        id, care_profile_id, dedupe_key, recipient_email, recipient_role,
        notification_type, subject, body_preview, status, processing_started_at, retry_count
    ) values (
        v_new_id, p_profile_id, p_dedupe_key, p_recipient_email, p_recipient_role,
        p_type, p_subject, p_body_preview, 'PROCESSING', now(), 0
    )
    returning * into v_job;

    return jsonb_build_object('dispatched', true, 'status', 'RESERVED', 'jobId', v_job.id);
exception
    when unique_violation then
        -- Concurrency race won by another worker
        return jsonb_build_object('dispatched', false, 'status', 'SUPPRESSED');
end;
$$;
