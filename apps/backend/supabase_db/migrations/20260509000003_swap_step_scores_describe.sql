-- Align swap_step_scores.step_code with the canonical 4-step set used by the
-- backend (DESCRIBE, REASONING, DDx, CONCLUSION). The swap_step_scores table
-- was created with the legacy 'OBSERVE' code, so writes from the swap flow
-- (which uses 'DESCRIBE') were rejected by the CHECK constraint.

-- Backfill any legacy rows so the new constraint can be applied.
update swap_step_scores set step_code = 'DESCRIBE' where step_code = 'OBSERVE';

alter table swap_step_scores
  drop constraint if exists swap_step_scores_step_code_check;

alter table swap_step_scores
  add constraint swap_step_scores_step_code_check
    check (step_code in ('DESCRIBE','REASONING','DDx','CONCLUSION'));
