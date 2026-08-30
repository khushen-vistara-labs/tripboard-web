-- TripBoard foundation: shared trip data, transactional finance, RLS, storage, and audit.
create extension if not exists pgcrypto;

create type public.trip_role as enum ('OWNER', 'MEMBER');
create type public.itinerary_item_type as enum ('attraction', 'food', 'transport', 'activity', 'booking', 'shopping', 'rest', 'hotel', 'other');
create type public.itinerary_priority as enum ('MUST', 'WANT', 'OPTIONAL');
create type public.itinerary_status as enum ('PLANNED', 'COMPLETED', 'SKIPPED', 'MOVED');
create type public.checklist_kind as enum ('PLACE', 'FOOD', 'EXPERIENCE', 'SHOPPING', 'OTHER');
create type public.checklist_status as enum ('PLANNED', 'COMPLETED', 'SKIPPED');
create type public.account_class as enum ('EXTERNAL_SOURCE', 'STORED_VALUE');
create type public.financial_event_type as enum ('PURCHASE', 'FUND_WALLET', 'INTERNAL_TRANSFER', 'CASH_EXCHANGE', 'PURCHASE_REFUND', 'FUNDING_REFUND', 'BALANCE_ADJUSTMENT');
create type public.settlement_status as enum ('PROVISIONAL', 'SETTLED');
create type public.booking_type as enum ('FLIGHT', 'HOTEL', 'ATTRACTION', 'FERRY', 'CRUISE', 'THEME_PARK', 'CABLE_CAR', 'TOUR', 'INSURANCE', 'ESIM', 'OTHER');
create type public.booking_status as enum ('PLACEHOLDER', 'CONFIRMED', 'USED', 'CANCELLED');
create type public.budget_scope as enum ('TRIP', 'CATEGORY', 'DAILY');
create type public.notification_type as enum ('MORNING_SUMMARY', 'LEAVE_SOON', 'OVERDUE_ITEM', 'END_OF_DAY', 'BUDGET_WARNING', 'BOOKING_REMINDER', 'LOW_WALLET', 'SYNC');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  timezone text not null default 'Asia/Hong_Kong',
  base_currency text not null default 'INR' check (base_currency ~ '^[A-Z]{3}$'),
  overdue_grace_minutes integer not null default 30 check (overdue_grace_minutes between 0 and 240),
  owner_id uuid not null references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.trip_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (trip_id, user_id)
);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, date)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  google_maps_url text,
  neighbourhood text,
  category text,
  opening_hours_notes text,
  notes text,
  expected_duration_minutes integer check (expected_duration_minutes > 0),
  image_path text,
  priority public.itinerary_priority not null default 'WANT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (trip_id, name, address)
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  description text,
  kind public.checklist_kind not null,
  priority public.itinerary_priority not null default 'WANT',
  target_count integer not null default 1 check (target_count > 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  linked_place_id uuid references public.places(id) on delete set null,
  planned_day date,
  status public.checklist_status not null default 'PLANNED',
  notes text,
  recommended_place text,
  neighbourhood text,
  dietary_warning text,
  photo_path text,
  rating smallint check (rating between 1 and 5),
  favourite boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_count <= target_count)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  type public.booking_type not null,
  title text not null,
  provider text,
  booking_reference text,
  starts_at timestamptz,
  location text,
  travellers text[],
  amount numeric(18,4) check (amount is null or amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  payment_account_id uuid,
  notes text,
  status public.booking_status not null default 'PLACEHOLDER',
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  itinerary_day_id uuid references public.itinerary_days(id) on delete cascade,
  date date not null,
  title text not null,
  description text,
  item_type public.itinerary_item_type not null default 'other',
  place_id uuid references public.places(id) on delete set null,
  checklist_item_id uuid references public.checklist_items(id) on delete set null,
  planned_start_time time,
  planned_end_time time,
  expected_duration_minutes integer check (expected_duration_minutes is null or expected_duration_minutes > 0),
  recommended_departure_time time,
  priority public.itinerary_priority not null default 'WANT',
  status public.itinerary_status not null default 'PLANNED',
  sequence integer not null default 0,
  estimated_cost numeric(18,4) check (estimated_cost is null or estimated_cost >= 0),
  estimated_cost_currency text check (estimated_cost_currency is null or estimated_cost_currency ~ '^[A-Z]{3}$'),
  booking_id uuid references public.bookings(id) on delete set null,
  maps_url text,
  transport_instructions text,
  notes text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checklist_items add column linked_itinerary_item_id uuid references public.itinerary_items(id) on delete set null;

create table public.booking_files (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  storage_path text not null unique,
  filename text not null check (filename !~ '[/\\]'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 15728640),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  account_class public.account_class not null,
  account_type text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issuing_bank text,
  network text,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  billing_currency text check (billing_currency is null or billing_currency ~ '^[A-Z]{3}$'),
  opening_balance numeric(18,4) not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, name)
);

alter table public.bookings add constraint bookings_payment_account_fk foreign key (payment_account_id) references public.payment_accounts(id) on delete set null;

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  transaction_type public.financial_event_type not null,
  occurred_at timestamptz not null,
  description text not null,
  merchant text,
  category text,
  source_account_id uuid references public.payment_accounts(id),
  destination_account_id uuid references public.payment_accounts(id),
  source_amount numeric(18,4),
  source_currency text check (source_currency is null or source_currency ~ '^[A-Z]{3}$'),
  destination_amount numeric(18,4),
  destination_currency text check (destination_currency is null or destination_currency ~ '^[A-Z]{3}$'),
  consumption_amount numeric(18,4),
  consumption_currency text check (consumption_currency is null or consumption_currency ~ '^[A-Z]{3}$'),
  estimated_inr_amount numeric(18,4),
  settled_inr_amount numeric(18,4),
  settlement_status public.settlement_status,
  linked_itinerary_item_id uuid references public.itinerary_items(id) on delete set null,
  linked_booking_id uuid references public.bookings(id) on delete set null,
  linked_place_id uuid references public.places(id) on delete set null,
  reversed_transaction_id uuid references public.financial_transactions(id),
  original_transaction_id uuid references public.financial_transactions(id),
  idempotency_key uuid not null,
  version integer not null default 1 check (version > 0),
  voided_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (trip_id, idempotency_key),
  check (source_amount is null or source_amount > 0),
  check (destination_amount is null or transaction_type = 'BALANCE_ADJUSTMENT' or destination_amount > 0),
  check (consumption_amount is null or consumption_amount > 0),
  check (estimated_inr_amount is null or estimated_inr_amount >= 0),
  check (settled_inr_amount is null or settled_inr_amount >= 0),
  check (source_account_id is distinct from destination_account_id)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text,
  amount numeric(18,4) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  budget_scope public.budget_scope not null,
  date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((budget_scope = 'DAILY' and date is not null) or (budget_scope <> 'DAILY' and date is null))
);

create table public.budget_notification_state (
  budget_id uuid not null references public.budgets(id) on delete cascade,
  threshold smallint not null check (threshold in (80, 100)),
  notified_at timestamptz not null default now(),
  primary key (budget_id, threshold)
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_currency text not null check (from_currency ~ '^[A-Z]{3}$'),
  to_currency text not null check (to_currency ~ '^[A-Z]{3}$'),
  rate numeric(24,10) not null check (rate > 0),
  source text not null,
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (from_currency <> to_currency)
);

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  morning_summary boolean not null default true,
  leave_soon boolean not null default true,
  overdue_item boolean not null default true,
  end_of_day boolean not null default true,
  budget_warning boolean not null default true,
  booking_reminder boolean not null default true,
  low_wallet boolean not null default false,
  primary key (user_id, trip_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  entity_id uuid,
  title text not null,
  body text not null,
  dedupe_key text not null,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index trip_members_active_user_idx on public.trip_members (user_id, trip_id) where removed_at is null;
create index itinerary_items_trip_date_sequence_idx on public.itinerary_items (trip_id, date, sequence);
create index checklist_items_trip_kind_status_idx on public.checklist_items (trip_id, kind, status);
create index places_trip_name_idx on public.places (trip_id, name);
create index bookings_trip_starts_idx on public.bookings (trip_id, starts_at);
create index financial_transactions_trip_time_idx on public.financial_transactions (trip_id, occurred_at desc);
create index financial_transactions_source_idx on public.financial_transactions (source_account_id, occurred_at);
create index financial_transactions_destination_idx on public.financial_transactions (destination_account_id, occurred_at);
create index notifications_unread_idx on public.notifications (user_id, trip_id, created_at desc) where read_at is null;
create index audit_events_trip_entity_idx on public.audit_events (trip_id, entity_type, entity_id, created_at desc);

create or replace function public.is_trip_member(check_trip_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = check_trip_id and user_id = check_user_id and removed_at is null
  );
$$;

create or replace function public.is_trip_owner(check_trip_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = check_trip_id and user_id = check_user_id and role = 'OWNER' and removed_at is null
  );
$$;

revoke all on function public.is_trip_member(uuid, uuid) from public;
revoke all on function public.is_trip_owner(uuid, uuid) from public;
grant execute on function public.is_trip_member(uuid, uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid, uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute function public.handle_new_user();

create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.owner_id, 'OWNER');
  return new;
end;
$$;

create trigger on_trip_created after insert on public.trips
for each row execute function public.add_owner_as_member();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();
create trigger itinerary_days_touch before update on public.itinerary_days for each row execute function public.touch_updated_at();
create trigger places_touch before update on public.places for each row execute function public.touch_updated_at();
create trigger checklist_items_touch before update on public.checklist_items for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();
create trigger itinerary_items_touch before update on public.itinerary_items for each row execute function public.touch_updated_at();
create trigger payment_accounts_touch before update on public.payment_accounts for each row execute function public.touch_updated_at();
create trigger budgets_touch before update on public.budgets for each row execute function public.touch_updated_at();

create or replace function public.audit_trip_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  trip uuid := coalesce(new.trip_id, old.trip_id);
  entity uuid := coalesce(new.id, old.id);
begin
  insert into public.audit_events (trip_id, actor_id, entity_type, entity_id, event_type, before_json, after_json)
  values (trip, auth.uid(), tg_table_name, entity, tg_op, case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;

create trigger itinerary_items_audit after insert or update or delete on public.itinerary_items for each row execute function public.audit_trip_change();
create trigger checklist_items_audit after insert or update or delete on public.checklist_items for each row execute function public.audit_trip_change();
create trigger bookings_audit after insert or update or delete on public.bookings for each row execute function public.audit_trip_change();
create trigger financial_transactions_audit after insert or update on public.financial_transactions for each row execute function public.audit_trip_change();

create or replace function public.stored_value_balance(account_id uuid)
returns numeric language sql stable security invoker set search_path = public
as $$
  select a.opening_balance + coalesce(sum(
    case
      when t.voided_at is not null then 0
      when t.transaction_type in ('FUND_WALLET', 'CASH_EXCHANGE', 'INTERNAL_TRANSFER', 'PURCHASE_REFUND') and t.destination_account_id = a.id then t.destination_amount
      when t.transaction_type = 'BALANCE_ADJUSTMENT' and coalesce(t.destination_account_id, t.source_account_id) = a.id then t.destination_amount
      when t.transaction_type in ('PURCHASE', 'INTERNAL_TRANSFER', 'FUNDING_REFUND') and t.source_account_id = a.id then -t.source_amount
      else 0
    end
  ), 0)
  from public.payment_accounts a
  left join public.financial_transactions t on (t.source_account_id = a.id or t.destination_account_id = a.id)
  where a.id = account_id and a.account_class = 'STORED_VALUE'
  group by a.id, a.opening_balance;
$$;

create view public.stored_value_balances with (security_invoker = true) as
select a.trip_id, a.id as account_id, a.name, a.currency, public.stored_value_balance(a.id) as balance
from public.payment_accounts a
where a.account_class = 'STORED_VALUE' and a.archived_at is null;

create view public.local_consumption_by_category with (security_invoker = true) as
select trip_id, consumption_currency as currency, coalesce(category, 'Miscellaneous') as category,
  sum(case when transaction_type = 'PURCHASE' then consumption_amount when transaction_type = 'PURCHASE_REFUND' then -consumption_amount else 0 end) as amount
from public.financial_transactions
where voided_at is null and transaction_type in ('PURCHASE', 'PURCHASE_REFUND')
group by trip_id, consumption_currency, coalesce(category, 'Miscellaneous');

create view public.own_money_outflow with (security_invoker = true) as
select trip_id,
  sum(case
    when transaction_type in ('PURCHASE', 'FUND_WALLET', 'CASH_EXCHANGE') then coalesce(settled_inr_amount, estimated_inr_amount, 0)
    when transaction_type in ('PURCHASE_REFUND', 'FUNDING_REFUND') and destination_account_id in (select id from public.payment_accounts where account_class = 'EXTERNAL_SOURCE') then -coalesce(settled_inr_amount, estimated_inr_amount, 0)
    else 0
  end) as inr_amount,
  bool_or(settled_inr_amount is null and estimated_inr_amount is not null) as includes_estimates
from public.financial_transactions
where voided_at is null
group by trip_id;

create or replace function public.assert_financial_member(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public
as $$ begin if not public.is_trip_member(p_trip_id, auth.uid()) then raise exception 'Not authorised for this trip' using errcode = '42501'; end if; end; $$;

create or replace function public.create_purchase(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_source_account_id uuid, p_amount numeric, p_currency text, p_category text,
  p_merchant text default null, p_estimated_inr_amount numeric default null, p_settled_inr_amount numeric default null,
  p_linked_itinerary_item_id uuid default null, p_linked_place_id uuid default null
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_existing public.financial_transactions; v_account public.payment_accounts; v_created public.financial_transactions;
begin
  perform public.assert_financial_member(p_trip_id);
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;
  if p_amount <= 0 or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid purchase amount or currency'; end if;
  select * into v_account from public.payment_accounts where id = p_source_account_id and trip_id = p_trip_id and archived_at is null for update;
  if not found then raise exception 'Payment account does not belong to this trip'; end if;
  if v_account.account_class = 'STORED_VALUE' then
    if v_account.currency <> p_currency then raise exception 'Wallet currency mismatch'; end if;
    if public.stored_value_balance(v_account.id) < p_amount then raise exception 'Not enough balance in %', v_account.name; end if;
  end if;
  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, merchant, category, source_account_id, source_amount, source_currency, consumption_amount, consumption_currency, estimated_inr_amount, settled_inr_amount, settlement_status, linked_itinerary_item_id, linked_place_id, idempotency_key)
  values (p_trip_id, 'PURCHASE', p_occurred_at, p_description, p_merchant, p_category, p_source_account_id, p_amount, p_currency, p_amount, p_currency, p_estimated_inr_amount, p_settled_inr_amount, case when p_settled_inr_amount is not null then 'SETTLED'::public.settlement_status when p_estimated_inr_amount is not null then 'PROVISIONAL'::public.settlement_status end, p_linked_itinerary_item_id, p_linked_place_id, p_idempotency_key)
  returning * into v_created;
  return v_created;
exception when unique_violation then select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; return v_existing;
end;
$$;

create or replace function public.fund_wallet(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_source_account_id uuid, p_destination_account_id uuid, p_destination_amount numeric, p_currency text,
  p_estimated_inr_amount numeric default null, p_settled_inr_amount numeric default null
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_existing public.financial_transactions; v_source public.payment_accounts; v_destination public.payment_accounts; v_created public.financial_transactions;
begin
  perform public.assert_financial_member(p_trip_id);
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; if found then return v_existing; end if;
  if p_destination_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select * into v_source from public.payment_accounts where id = p_source_account_id and trip_id = p_trip_id for update;
  select * into v_destination from public.payment_accounts where id = p_destination_account_id and trip_id = p_trip_id for update;
  if v_source.account_class <> 'EXTERNAL_SOURCE' or v_destination.account_class <> 'STORED_VALUE' then raise exception 'Funding must move from an external source to stored value'; end if;
  if v_destination.currency <> p_currency then raise exception 'Wallet currency mismatch'; end if;
  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, source_account_id, destination_account_id, destination_amount, destination_currency, estimated_inr_amount, settled_inr_amount, settlement_status, idempotency_key)
  values (p_trip_id, 'FUND_WALLET', p_occurred_at, p_description, p_source_account_id, p_destination_account_id, p_destination_amount, p_currency, p_estimated_inr_amount, p_settled_inr_amount, case when p_settled_inr_amount is not null then 'SETTLED'::public.settlement_status else 'PROVISIONAL'::public.settlement_status end, p_idempotency_key) returning * into v_created;
  return v_created;
exception when unique_violation then select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; return v_existing;
end;
$$;

create or replace function public.create_internal_transfer(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_source_account_id uuid, p_destination_account_id uuid, p_source_amount numeric, p_source_currency text,
  p_destination_amount numeric default null, p_destination_currency text default null
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_existing public.financial_transactions; v_source public.payment_accounts; v_destination public.payment_accounts; v_created public.financial_transactions; v_received numeric := coalesce(p_destination_amount, p_source_amount); v_received_currency text := coalesce(p_destination_currency, p_source_currency);
begin
  perform public.assert_financial_member(p_trip_id);
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; if found then return v_existing; end if;
  if p_source_account_id = p_destination_account_id or p_source_amount <= 0 or v_received <= 0 then raise exception 'Invalid transfer'; end if;
  select * into v_source from public.payment_accounts where id = p_source_account_id and trip_id = p_trip_id for update;
  select * into v_destination from public.payment_accounts where id = p_destination_account_id and trip_id = p_trip_id for update;
  if v_source.account_class <> 'STORED_VALUE' or v_destination.account_class <> 'STORED_VALUE' then raise exception 'Internal transfers require two stored-value accounts'; end if;
  if v_source.currency <> p_source_currency or v_destination.currency <> v_received_currency then raise exception 'Account currency mismatch'; end if;
  if public.stored_value_balance(v_source.id) < p_source_amount then raise exception 'Not enough balance in %', v_source.name; end if;
  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, source_account_id, destination_account_id, source_amount, source_currency, destination_amount, destination_currency, idempotency_key)
  values (p_trip_id, 'INTERNAL_TRANSFER', p_occurred_at, p_description, p_source_account_id, p_destination_account_id, p_source_amount, p_source_currency, v_received, v_received_currency, p_idempotency_key) returning * into v_created;
  return v_created;
exception when unique_violation then select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; return v_existing;
end;
$$;

create or replace function public.create_cash_exchange(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_source_account_id uuid, p_destination_account_id uuid, p_source_amount numeric, p_source_currency text,
  p_destination_amount numeric, p_destination_currency text, p_settled_inr_amount numeric
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_existing public.financial_transactions; v_source public.payment_accounts; v_destination public.payment_accounts; v_created public.financial_transactions;
begin
  perform public.assert_financial_member(p_trip_id);
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; if found then return v_existing; end if;
  if p_source_amount <= 0 or p_destination_amount <= 0 or p_settled_inr_amount < 0 then raise exception 'Invalid exchange amounts'; end if;
  select * into v_source from public.payment_accounts where id = p_source_account_id and trip_id = p_trip_id for update;
  select * into v_destination from public.payment_accounts where id = p_destination_account_id and trip_id = p_trip_id for update;
  if v_source.account_class <> 'EXTERNAL_SOURCE' or v_destination.account_class <> 'STORED_VALUE' then raise exception 'Cash exchange must originate externally and fund stored cash'; end if;
  if v_source.currency <> p_source_currency or v_destination.currency <> p_destination_currency then raise exception 'Account currency mismatch'; end if;
  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, source_account_id, destination_account_id, source_amount, source_currency, destination_amount, destination_currency, settled_inr_amount, settlement_status, idempotency_key)
  values (p_trip_id, 'CASH_EXCHANGE', p_occurred_at, p_description, p_source_account_id, p_destination_account_id, p_source_amount, p_source_currency, p_destination_amount, p_destination_currency, p_settled_inr_amount, 'SETTLED', p_idempotency_key) returning * into v_created;
  return v_created;
exception when unique_violation then select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; return v_existing;
end;
$$;

create or replace function public.create_purchase_refund(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_original_transaction_id uuid, p_destination_account_id uuid, p_amount numeric, p_currency text,
  p_settled_inr_amount numeric default null
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_existing public.financial_transactions; v_original public.financial_transactions; v_destination public.payment_accounts; v_created public.financial_transactions; v_prior_refunds numeric;
begin
  perform public.assert_financial_member(p_trip_id);
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; if found then return v_existing; end if;
  select * into v_original from public.financial_transactions where id = p_original_transaction_id and trip_id = p_trip_id and transaction_type = 'PURCHASE' for update;
  if not found then raise exception 'Original purchase not found'; end if;
  select coalesce(sum(consumption_amount), 0) into v_prior_refunds from public.financial_transactions where original_transaction_id = v_original.id and transaction_type = 'PURCHASE_REFUND' and voided_at is null;
  if p_amount <= 0 or p_amount + v_prior_refunds > v_original.consumption_amount or p_currency <> v_original.consumption_currency then raise exception 'Refund exceeds the refundable purchase amount'; end if;
  select * into v_destination from public.payment_accounts where id = p_destination_account_id and trip_id = p_trip_id for update;
  if not found or (v_destination.account_class = 'STORED_VALUE' and v_destination.currency <> p_currency) then raise exception 'Invalid refund destination'; end if;
  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, category, destination_account_id, destination_amount, destination_currency, consumption_amount, consumption_currency, settled_inr_amount, settlement_status, original_transaction_id, idempotency_key)
  values (p_trip_id, 'PURCHASE_REFUND', p_occurred_at, p_description, v_original.category, p_destination_account_id, p_amount, p_currency, p_amount, p_currency, p_settled_inr_amount, case when p_settled_inr_amount is null then null else 'SETTLED'::public.settlement_status end, v_original.id, p_idempotency_key) returning * into v_created;
  return v_created;
exception when unique_violation then select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; return v_existing;
end;
$$;

create or replace function public.create_funding_refund(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_source_account_id uuid, p_destination_account_id uuid, p_amount numeric, p_currency text,
  p_settled_inr_amount numeric default null
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_existing public.financial_transactions; v_source public.payment_accounts; v_destination public.payment_accounts; v_created public.financial_transactions;
begin
  perform public.assert_financial_member(p_trip_id);
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; if found then return v_existing; end if;
  select * into v_source from public.payment_accounts where id = p_source_account_id and trip_id = p_trip_id for update;
  select * into v_destination from public.payment_accounts where id = p_destination_account_id and trip_id = p_trip_id for update;
  if v_source.account_class <> 'STORED_VALUE' or v_destination.account_class <> 'EXTERNAL_SOURCE' or v_source.currency <> p_currency then raise exception 'Invalid funding refund accounts'; end if;
  if p_amount <= 0 or public.stored_value_balance(v_source.id) < p_amount then raise exception 'Not enough balance in %', v_source.name; end if;
  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, source_account_id, destination_account_id, source_amount, source_currency, settled_inr_amount, settlement_status, idempotency_key)
  values (p_trip_id, 'FUNDING_REFUND', p_occurred_at, p_description, p_source_account_id, p_destination_account_id, p_amount, p_currency, p_settled_inr_amount, case when p_settled_inr_amount is null then null else 'SETTLED'::public.settlement_status end, p_idempotency_key) returning * into v_created;
  return v_created;
exception when unique_violation then select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; return v_existing;
end;
$$;

create or replace function public.create_balance_adjustment(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_account_id uuid, p_adjustment numeric, p_currency text
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_existing public.financial_transactions; v_account public.payment_accounts; v_created public.financial_transactions;
begin
  perform public.assert_financial_member(p_trip_id);
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; if found then return v_existing; end if;
  select * into v_account from public.payment_accounts where id = p_account_id and trip_id = p_trip_id for update;
  if v_account.account_class <> 'STORED_VALUE' or v_account.currency <> p_currency or p_adjustment = 0 then raise exception 'Invalid balance adjustment'; end if;
  if public.stored_value_balance(v_account.id) + p_adjustment < 0 then raise exception 'Not enough balance in %', v_account.name; end if;
  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, destination_account_id, destination_amount, destination_currency, idempotency_key)
  values (p_trip_id, 'BALANCE_ADJUSTMENT', p_occurred_at, p_description, p_account_id, p_adjustment, p_currency, p_idempotency_key) returning * into v_created;
  return v_created;
exception when unique_violation then select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key; return v_existing;
end;
$$;

create or replace function public.settle_card_transaction(p_transaction_id uuid, p_expected_version integer, p_settled_inr_amount numeric)
returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_transaction public.financial_transactions; v_account public.payment_accounts;
begin
  select * into v_transaction from public.financial_transactions where id = p_transaction_id for update;
  if not found or not public.is_trip_member(v_transaction.trip_id, auth.uid()) then raise exception 'Transaction not found or not authorised'; end if;
  select * into v_account from public.payment_accounts where id = v_transaction.source_account_id;
  if v_account.account_class <> 'EXTERNAL_SOURCE' then raise exception 'Only external card transactions can be settled'; end if;
  if v_transaction.version <> p_expected_version then raise exception 'Version conflict: reload before editing'; end if;
  if p_settled_inr_amount < 0 then raise exception 'Settlement must not be negative'; end if;
  update public.financial_transactions set settled_inr_amount = p_settled_inr_amount, settlement_status = 'SETTLED', version = version + 1, updated_by = auth.uid(), updated_at = now() where id = p_transaction_id returning * into v_transaction;
  return v_transaction;
end;
$$;

revoke all on function public.assert_financial_member(uuid) from public;
grant execute on function public.create_purchase(uuid, uuid, timestamptz, text, uuid, numeric, text, text, text, numeric, numeric, uuid, uuid) to authenticated;
grant execute on function public.fund_wallet(uuid, uuid, timestamptz, text, uuid, uuid, numeric, text, numeric, numeric) to authenticated;
grant execute on function public.create_internal_transfer(uuid, uuid, timestamptz, text, uuid, uuid, numeric, text, numeric, text) to authenticated;
grant execute on function public.create_cash_exchange(uuid, uuid, timestamptz, text, uuid, uuid, numeric, text, numeric, text, numeric) to authenticated;
grant execute on function public.create_purchase_refund(uuid, uuid, timestamptz, text, uuid, uuid, numeric, text, numeric) to authenticated;
grant execute on function public.create_funding_refund(uuid, uuid, timestamptz, text, uuid, uuid, numeric, text, numeric) to authenticated;
grant execute on function public.create_balance_adjustment(uuid, uuid, timestamptz, text, uuid, numeric, text) to authenticated;
grant execute on function public.settle_card_transaction(uuid, integer, numeric) to authenticated;

create or replace function public.accept_trip_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_invite public.trip_invites; v_trip_id uuid;
begin
  select * into v_invite from public.trip_invites where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_invite.expires_at < now() or v_invite.accepted_at is not null then raise exception 'Invitation is invalid or expired'; end if;
  if lower(v_invite.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'Sign in with the invited email address'; end if;
  insert into public.trip_members (trip_id, user_id, role) values (v_invite.trip_id, auth.uid(), 'MEMBER') on conflict (trip_id, user_id) do update set removed_at = null;
  update public.trip_invites set accepted_at = now() where id = v_invite.id;
  v_trip_id := v_invite.trip_id;
  return v_trip_id;
end;
$$;
grant execute on function public.accept_trip_invite(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.places enable row level security;
alter table public.checklist_items enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_files enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_notification_state enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy trips_member_read on public.trips for select using (public.is_trip_member(id));
create policy trips_create on public.trips for insert with check (owner_id = auth.uid());
create policy trips_owner_update on public.trips for update using (public.is_trip_owner(id)) with check (public.is_trip_owner(id));
create policy trips_owner_delete on public.trips for delete using (public.is_trip_owner(id));
create policy trip_members_member_read on public.trip_members for select using (public.is_trip_member(trip_id));
create policy trip_members_owner_insert on public.trip_members for insert with check (public.is_trip_owner(trip_id));
create policy trip_members_owner_update on public.trip_members for update using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy trip_members_owner_delete on public.trip_members for delete using (public.is_trip_owner(trip_id));
create policy invites_owner_all on public.trip_invites for all using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

create policy itinerary_days_member_all on public.itinerary_days for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy itinerary_items_member_all on public.itinerary_items for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy places_member_all on public.places for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy checklist_items_member_all on public.checklist_items for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy bookings_member_all on public.bookings for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy booking_files_member_all on public.booking_files for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy payment_accounts_member_read on public.payment_accounts for select using (public.is_trip_member(trip_id));
create policy payment_accounts_member_insert on public.payment_accounts for insert with check (public.is_trip_member(trip_id));
create policy payment_accounts_member_update on public.payment_accounts for update using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy financial_transactions_member_read on public.financial_transactions for select using (public.is_trip_member(trip_id));
create policy budgets_member_all on public.budgets for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy budget_notification_state_member_read on public.budget_notification_state for select using (exists (select 1 from public.budgets b where b.id = budget_id and public.is_trip_member(b.trip_id)));
create policy exchange_rates_member_all on public.exchange_rates for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy notification_preferences_self_all on public.notification_preferences for all using (user_id = auth.uid() and public.is_trip_member(trip_id)) with check (user_id = auth.uid() and public.is_trip_member(trip_id));
create policy notifications_self_read on public.notifications for select using (user_id = auth.uid() and public.is_trip_member(trip_id));
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_self_all on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_events_member_read on public.audit_events for select using (public.is_trip_member(trip_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-documents', 'booking-documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy booking_documents_member_read on storage.objects for select to authenticated
using (bucket_id = 'booking-documents' and public.is_trip_member(((storage.foldername(name))[1])::uuid));
create policy booking_documents_member_insert on storage.objects for insert to authenticated
with check (bucket_id = 'booking-documents' and public.is_trip_member(((storage.foldername(name))[1])::uuid));
create policy booking_documents_member_delete on storage.objects for delete to authenticated
using (bucket_id = 'booking-documents' and public.is_trip_member(((storage.foldername(name))[1])::uuid));

alter publication supabase_realtime add table public.itinerary_items, public.checklist_items, public.bookings, public.payment_accounts, public.financial_transactions, public.notifications;
