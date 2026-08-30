-- Optimistic concurrency tokens for shared records that may be edited offline.

alter table public.trips add column version integer not null default 1 check (version > 0);
alter table public.itinerary_days add column version integer not null default 1 check (version > 0);
alter table public.itinerary_items add column version integer not null default 1 check (version > 0);
alter table public.checklist_items add column version integer not null default 1 check (version > 0);
alter table public.places add column version integer not null default 1 check (version > 0);
alter table public.bookings add column version integer not null default 1 check (version > 0);
alter table public.payment_accounts add column version integer not null default 1 check (version > 0);
alter table public.budgets add column version integer not null default 1 check (version > 0);
alter table public.notification_preferences add column version integer not null default 1 check (version > 0);
alter table public.trip_members add column version integer not null default 1 check (version > 0);

create or replace function public.bump_record_version()
returns trigger language plpgsql set search_path = public
as $$ begin new.version = old.version + 1; return new; end; $$;

create trigger trips_version before update on public.trips for each row execute function public.bump_record_version();
create trigger itinerary_days_version before update on public.itinerary_days for each row execute function public.bump_record_version();
create trigger itinerary_items_version before update on public.itinerary_items for each row execute function public.bump_record_version();
create trigger checklist_items_version before update on public.checklist_items for each row execute function public.bump_record_version();
create trigger places_version before update on public.places for each row execute function public.bump_record_version();
create trigger bookings_version before update on public.bookings for each row execute function public.bump_record_version();
create trigger payment_accounts_version before update on public.payment_accounts for each row execute function public.bump_record_version();
create trigger budgets_version before update on public.budgets for each row execute function public.bump_record_version();
create trigger notification_preferences_version before update on public.notification_preferences for each row execute function public.bump_record_version();
create trigger trip_members_version before update on public.trip_members for each row execute function public.bump_record_version();

alter publication supabase_realtime add table public.booking_files;

create or replace function public.remove_trip_member_versioned(p_trip_id uuid, p_user_id uuid, p_expected_version integer, p_reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_version integer;
begin
  select version into v_version from public.trip_members where trip_id = p_trip_id and user_id = p_user_id for update;
  if not found then raise exception 'Member not found'; end if;
  if v_version <> p_expected_version then raise exception 'Version conflict: member access changed on another device' using errcode = '40001'; end if;
  perform public.remove_trip_member(p_trip_id, p_user_id, p_reason);
end;
$$;
revoke all on function public.remove_trip_member_versioned(uuid, uuid, integer, text) from public;
grant execute on function public.remove_trip_member_versioned(uuid, uuid, integer, text) to authenticated;
