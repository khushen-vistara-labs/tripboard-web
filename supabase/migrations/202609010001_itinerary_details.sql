-- Additive structured trip context. Existing itinerary rows remain valid and
-- continue to render unchanged when they have no details.
alter table public.itinerary_items
  add column if not exists details jsonb not null default '{}'::jsonb;

comment on column public.itinerary_items.details is
  'Structured planning context: transport choices, costs, booking, weather, food, payment and fallback information.';
