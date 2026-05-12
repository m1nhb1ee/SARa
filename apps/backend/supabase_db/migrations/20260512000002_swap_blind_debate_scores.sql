alter table swap_step_states
  add column if not exists debate_score_online float check (debate_score_online between 0 and 1),
  add column if not exists knowledge_score_final float check (knowledge_score_final between 0 and 1),
  add column if not exists accuracy_score_final float check (accuracy_score_final between 0 and 1),
  add column if not exists reasoning_online text not null default '',
  add column if not exists reasoning_final text not null default '';
