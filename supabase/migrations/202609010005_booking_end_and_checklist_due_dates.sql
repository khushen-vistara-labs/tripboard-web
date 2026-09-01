alter table public.bookings add column if not exists ends_at timestamptz;
alter table public.checklist_items add column if not exists due_date date;

comment on column public.bookings.ends_at is 'End, checkout, or arrival timestamp when known.';
comment on column public.checklist_items.due_date is 'Preparation deadline, distinct from the activity day.';
