alter table public.trip_notes
  add column pronunciation text check (char_length(pronunciation) <= 300),
  add column meaning text check (char_length(meaning) <= 300);
