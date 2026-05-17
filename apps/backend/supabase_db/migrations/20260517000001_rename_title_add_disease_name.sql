-- Rename cases.title → cases.disease_name (stores the specific disease label,
-- e.g. "Basal ganglia hemorrhage").
-- Add cases.title as the region+modality display label, e.g. "Brain CT", "Chest X-ray".
alter table cases rename column title to disease_name;

alter table cases add column title text;

