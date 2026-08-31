create table public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  section text not null check (char_length(section) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '',
  sort_order integer not null default 0,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_notes_trip_section_order_idx on public.trip_notes (trip_id, section, sort_order, created_at);
alter table public.trip_notes enable row level security;
create policy trip_notes_member_all on public.trip_notes for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
