-- Hot query paths
create index on sessions (user_id);
create index on sessions (case_id);
create index on sessions (status);
create index on step_attempts (session_id);
create index on step_attempts (step_code);
create index on pipeline_replays (session_id);
create index on case_recommendations (user_id);
create index on upload_messages (upload_session_id);

-- Tag search on cases (GIN for array containment queries)
create index on cases using gin (tags);
create index on cases (disease_tag);
create index on cases (status);