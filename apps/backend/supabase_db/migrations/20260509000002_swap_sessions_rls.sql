-- Enable RLS + add policies for swap_* tables.
-- Mirrors the sessions/step_attempts policy style and adds an explicit
-- service_role bypass policy (the backend uses SUPABASE_SERVICE_KEY).

alter table swap_sessions    enable row level security;
alter table swap_messages    enable row level security;
alter table swap_step_scores enable row level security;

-- swap_sessions: a user can read/write their own swap sessions
create policy "swap_sessions: own rows" on swap_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "swap_sessions: service role manage" on swap_sessions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- swap_messages: scoped through the parent swap_session ownership
create policy "swap_messages: own rows" on swap_messages
  for all using (
    swap_session_id in (select id from swap_sessions where user_id = auth.uid())
  )
  with check (
    swap_session_id in (select id from swap_sessions where user_id = auth.uid())
  );

create policy "swap_messages: service role manage" on swap_messages
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- swap_step_scores: same scoping as messages
create policy "swap_step_scores: own rows" on swap_step_scores
  for all using (
    swap_session_id in (select id from swap_sessions where user_id = auth.uid())
  )
  with check (
    swap_session_id in (select id from swap_sessions where user_id = auth.uid())
  );

create policy "swap_step_scores: service role manage" on swap_step_scores
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
