-- Enable Row Level Security on all tables
alter table users               enable row level security;
alter table cases               enable row level security;
alter table sessions            enable row level security;
alter table step_attempts       enable row level security;
alter table pipeline_replays    enable row level security;
alter table user_skill_profiles enable row level security;
alter table case_recommendations enable row level security;
alter table upload_sessions     enable row level security;
alter table upload_messages     enable row level security;

-- Users can only read/write their own data
create policy "users: own row" on users
  for all using (auth.uid() = id);

create policy "sessions: own sessions" on sessions
  for all using (auth.uid() = user_id);

create policy "step_attempts: own attempts" on step_attempts
  for all using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "pipeline_replays: own replays" on pipeline_replays
  for all using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "user_skill_profiles: own profile" on user_skill_profiles
  for all using (auth.uid() = user_id);

create policy "case_recommendations: own recs" on case_recommendations
  for all using (auth.uid() = user_id);

create policy "upload_sessions: own uploads" on upload_sessions
  for all using (auth.uid() = user_id);

create policy "upload_messages: own messages" on upload_messages
  for all using (
    upload_session_id in (select id from upload_sessions where user_id = auth.uid())
  );

-- Cases are publicly readable if published, writable only by admin/advisor
create policy "cases: public read" on cases
  for select using (status = 'published');

create policy "cases: admin write" on cases
  for all using (
    auth.uid() in (select id from users where role in ('admin', 'medical_advisor'))
  );