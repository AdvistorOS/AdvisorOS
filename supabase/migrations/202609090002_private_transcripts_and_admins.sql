begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Browser reads follow the same adviser ownership boundary as meetings.
-- Transcription writes use the server's service role.
alter table public.transcripts enable row level security;
create policy "advisers read own transcripts" on public.transcripts
  for select to authenticated using (
    exists (select 1 from public.meetings m
      where m.id = transcripts.meeting_id and m.adviser_id = (select auth.uid()))
  );

-- Existing adviser policies check this table against the authenticated email.
-- Keep that self-check working without exposing or permitting edits to the list.
alter table public.super_admins enable row level security;
create policy "admins read own membership" on public.super_admins
  for select to authenticated using (email = (select auth.jwt() ->> 'email'));
commit;
