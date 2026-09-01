alter table public.trip_notes
  add column summary text check (char_length(summary) <= 240),
  add column icon text check (char_length(icon) <= 16),
  add column copy_text text;
