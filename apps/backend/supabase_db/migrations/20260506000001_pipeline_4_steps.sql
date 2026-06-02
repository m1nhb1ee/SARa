-- Migrate diagnosis pipeline from 6 steps to 4 steps:
-- OBSERVE + DESCRIBE → OBSERVE
-- INTERPRET + HYPOTHESIS → REASONING
-- DDx stays
-- CONCLUSION stays

-- ── Clear dependent data first (FK: step_attempts → step_rubrics) ─────────────

-- pipeline_replays references sessions (cascade), clear it for the constraint update
delete from pipeline_replays;

-- step_attempts.rubric_criterion_id is NOT NULL references step_rubrics ON DELETE RESTRICT
-- old attempt history is invalidated by the pipeline change anyway
delete from step_attempts;

-- ── step_rubrics ──────────────────────────────────────────────────────────────

alter table step_rubrics
  drop constraint if exists step_rubrics_step_code_check;

delete from step_rubrics;

insert into step_rubrics (step_code, criterion_label, scoring_guide, max_score) values
('OBSERVE',
 'Observation of findings',
 'Award full marks if student identifies the image type/modality, locates abnormal regions, and describes location, size, density/signal, margins, and laterality of significant findings using correct radiological terminology.',
 1.0),
('REASONING',
 'Clinical reasoning and working diagnosis',
 'Award full marks if student correctly interprets the clinical significance of findings (linking imaging features to pathophysiology) and proposes a clear, specific working diagnosis with supporting reasoning.',
 1.0),
('DDx',
 'Differential diagnosis',
 'Award full marks if student lists at least 2–3 plausible differentials ranked by likelihood, with brief justification for each based on imaging findings.',
 1.0),
('CONCLUSION',
 'Final diagnosis and management',
 'Award full marks if student states the most likely diagnosis with confidence level and suggests appropriate next steps (further imaging, labs, or treatment).',
 1.0);

alter table step_rubrics
  add constraint step_rubrics_step_code_check
    check (step_code in ('OBSERVE','REASONING','DDx','CONCLUSION'));

-- ── sessions ──────────────────────────────────────────────────────────────────

alter table sessions
  drop constraint if exists sessions_current_step_check;

-- Clamp any in-progress sessions to the new max step before adding constraint
update sessions set current_step = 3 where current_step > 3;

alter table sessions
  add constraint sessions_current_step_check
    check (current_step between 0 and 3);

-- ── answer_keys ───────────────────────────────────────────────────────────────

alter table answer_keys
  drop constraint if exists answer_keys_step_order_check;

alter table answer_keys
  drop constraint if exists answer_keys_step_code_check;

-- Remap INTERPRET → REASONING at step_order=1 (keep the content, change the step)
-- Do this before deleting so the data survives as REASONING
update answer_keys set step_code = 'REASONING', step_order = 1
  where step_code = 'INTERPRET';

-- Remove the now-redundant merged-away steps (DESCRIBE, HYPOTHESIS, and any duplicate INTERPRET)
delete from answer_keys where step_code in ('DESCRIBE', 'HYPOTHESIS');

-- Shift DDx and CONCLUSION to their new positions
update answer_keys set step_order = 2 where step_code = 'DDx';
update answer_keys set step_order = 3 where step_code = 'CONCLUSION';

alter table answer_keys
  add constraint answer_keys_step_order_check
    check (step_order between 0 and 3);

alter table answer_keys
  add constraint answer_keys_step_code_check
    check (step_code in ('OBSERVE','REASONING','DDx','CONCLUSION'));

-- ── step_attempts ─────────────────────────────────────────────────────────────

alter table step_attempts
  drop constraint if exists step_attempts_step_index_check;

alter table step_attempts
  add constraint step_attempts_step_index_check
    check (step_index between 0 and 3);

-- ── pipeline_replays ──────────────────────────────────────────────────────────

alter table pipeline_replays
  drop constraint if exists pipeline_replays_step_order_check;

alter table pipeline_replays
  add constraint pipeline_replays_step_order_check
    check (step_order between 0 and 3);
