create table step_rubrics (
  id               uuid primary key default gen_random_uuid(),
  step_code        text not null unique
                     check (step_code in ('OBSERVE','DESCRIBE','INTERPRET','HYPOTHESIS','DDx','CONCLUSION')),
  criterion_label  text not null,
  scoring_guide    text not null,
  example_good_answer text,
  max_score        float not null default 1.0
);

-- Seed the 5 generic rubrics immediately after creating the table
insert into step_rubrics (step_code, criterion_label, scoring_guide, max_score) values
('OBSERVE',
 'Initial image observation',
 'Award full marks if student identifies: image type/modality, patient orientation, overall image quality, and at least one abnormal region without interpreting it yet.',
 1.0),
('DESCRIBE',
 'Systematic description of findings',
 'Award full marks if student describes location, size, density/signal, margins, and laterality of all significant findings using correct radiological terminology.',
 1.0),
('INTERPRET',
 'Interpretation of findings',
 'Award full marks if student correctly interprets what the described findings indicate pathophysiologically, linking imaging features to underlying disease process.',
 1.0),
('DDx',
 'Differential diagnosis',
 'Award full marks if student lists at least 3 plausible differentials ranked by likelihood, with brief justification for each based on the imaging findings.',
 1.0),
('HYPOTHESIS',
 'Hypothesis formation',
 'Award full marks if student proposes a clear working hypothesis linking the key imaging findings to a specific pathological process, with reasoning.',
 1.0),
('CONCLUSION',
 'Final diagnosis and management',
 'Award full marks if student states the most likely diagnosis with confidence level and suggests appropriate next steps (further imaging, labs, or treatment).',
 1.0);