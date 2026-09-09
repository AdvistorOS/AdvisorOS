-- Apply in Supabase before deploying the accompanying application changes.
-- These functions are service-role only; API handlers enforce meeting ownership.
begin;
alter table public.meetings add column if not exists processing_token uuid;
alter table public.meetings add column if not exists processing_started_at timestamptz;
alter table public.meetings add column if not exists transcript_job_id text;
alter table public.meetings add column if not exists processing_error text;

create or replace function public.begin_meeting_processing(p_id uuid, p_phase text, p_retry boolean default false)
returns uuid language plpgsql security invoker set search_path = public as $$
declare m public.meetings; token uuid := gen_random_uuid();
begin
  if p_phase not in ('transcribing', 'extracting') then raise exception 'Invalid processing phase'; end if;
  select * into m from public.meetings where id = p_id for update;
  if not found then return null; end if;
  if m.status in ('done', 'approved') then return null; end if;
  if m.processing_token is not null and m.status in ('transcribing', 'extracting', 'summarizing') then
    -- Audio may take much longer than analysis; never start another active job.
    if not p_retry or m.processing_started_at > now() -
      (case when m.status = 'transcribing' then interval '2 hours' else interval '6 minutes' end) then
      return null;
    end if;
  end if;
  update public.meetings set status = p_phase, processing_token = token,
    processing_started_at = now(), processing_error = null, transcript_job_id = null where id = p_id;
  return token;
end $$;

create or replace function public.save_meeting_transcript(p_id uuid, p_token uuid, p_text text, p_utterances jsonb)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.meetings where id = p_id and processing_token = p_token
    and status in ('transcribing', 'extracting') for update;
  if not found then return false; end if;
  -- One transaction: keep the old transcript if the new insert fails.
  delete from public.transcripts where meeting_id = p_id;
  insert into public.transcripts(meeting_id, full_text, utterances) values(p_id, p_text, p_utterances);
  update public.meetings set status = 'extracting', processing_started_at = now() where id = p_id;
  return true;
end $$;

create or replace function public.save_meeting_analysis(p_id uuid, p_token uuid, p_facts jsonb, p_summary text)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.meetings where id = p_id and processing_token = p_token
    and status = 'summarizing' for update;
  if not found then return false; end if;
  delete from public.extracted_facts where meeting_id = p_id and category = 'facts';
  insert into public.extracted_facts(meeting_id, category, payload) values(p_id, 'facts', p_facts);
  delete from public.internal_notes where meeting_id = p_id and type = 'sentiment';
  if p_facts->'client_sentiment' is not null then
    insert into public.internal_notes(meeting_id, type, payload) values(p_id, 'sentiment', p_facts->'client_sentiment');
  end if;
  update public.meetings set status = 'done', client_summary = p_summary, processing_error = null where id = p_id;
  return true;
end $$;

revoke all on function public.begin_meeting_processing(uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.save_meeting_transcript(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.save_meeting_analysis(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.begin_meeting_processing(uuid,text,boolean) to service_role;
grant execute on function public.save_meeting_transcript(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.save_meeting_analysis(uuid,uuid,jsonb,text) to service_role;
commit;
