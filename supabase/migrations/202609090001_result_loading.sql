begin;
alter table public.meetings add column if not exists enrichment_status text not null default 'idle';
-- Keep this replacement in sync with the first migration; apply both in order.
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
  update public.meetings set status = 'done', client_summary = p_summary,
    processing_error = null, enrichment_status = 'pending' where id = p_id;
  return true;
end $$;
revoke all on function public.save_meeting_analysis(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_meeting_analysis(uuid,uuid,jsonb,text) to service_role;
commit;
