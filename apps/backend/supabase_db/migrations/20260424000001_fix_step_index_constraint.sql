-- Fix step_attempts to support 6-step pipeline (0..5 instead of 0..4)
alter table step_attempts
  drop constraint if exists step_attempts_step_index_check;

alter table step_attempts
  add constraint step_attempts_step_index_check
    check (step_index between 0 and 5);

-- Fix answer_keys to support HYPOTHESIS (6th step code)
alter table answer_keys
  drop constraint if exists answer_keys_step_order_check;

alter table answer_keys
  add constraint answer_keys_step_order_check
    check (step_order between 0 and 5);

alter table answer_keys
  drop constraint if exists answer_keys_step_code_check;

alter table answer_keys
  add constraint answer_keys_step_code_check
    check (step_code in ('OBSERVE','DESCRIBE','INTERPRET','HYPOTHESIS','DDx','CONCLUSION'));
