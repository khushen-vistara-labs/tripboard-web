begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-rls@example.com', '', now(), '{}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-rls@example.com', '', now(), '{}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'removed-rls@example.com', '', now(), '{}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider-rls@example.com', '', now(), '{}', '{}', now(), now());

insert into public.trips (id, name, start_date, end_date, timezone, base_currency, owner_id)
values ('21000000-0000-0000-0000-000000000001', 'Collaboration RLS', '2026-12-24', '2026-12-26', 'Asia/Hong_Kong', 'INR', '11000000-0000-0000-0000-000000000001');
insert into public.trip_members (trip_id, user_id, role, removed_at) values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'MEMBER', null),
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'MEMBER', now());
insert into public.itinerary_days (id, trip_id, date, title) values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '2026-12-24', 'Arrival');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner-rls@example.com', true);
select ok(public.is_trip_owner('21000000-0000-0000-0000-000000000001'), 'owner is recognised');
select is((select count(*) from public.trips where id='21000000-0000-0000-0000-000000000001'), 1::bigint, 'owner reads trip');
select is((select count(*) from public.trip_members where trip_id='21000000-0000-0000-0000-000000000001'), 3::bigint, 'owner reads membership history');
select lives_ok($$ select public.create_trip_invite('21000000-0000-0000-0000-000000000001', 'new@example.com') $$, 'owner creates invite');
select throws_ok($$ select public.remove_trip_member('21000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','test') $$, 'P0001', 'The trip owner cannot be removed', 'owner cannot remove self');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'member-rls@example.com', true);
select ok(public.is_trip_member('21000000-0000-0000-0000-000000000001'), 'active member is recognised');
select is((select count(*) from public.trips where id='21000000-0000-0000-0000-000000000001'), 1::bigint, 'member reads trip');
select is((select count(*) from public.itinerary_days where trip_id='21000000-0000-0000-0000-000000000001'), 1::bigint, 'member reads shared day');
select throws_ok($$ select public.create_trip_invite('21000000-0000-0000-0000-000000000001', 'blocked@example.com') $$, '42501', 'Only the trip owner can invite members', 'member cannot invite');
select throws_ok($$ select public.remove_trip_member('21000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000003','test') $$, '42501', 'Only the trip owner can remove members', 'member cannot remove another member');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.email', 'removed-rls@example.com', true);
select ok(not public.is_trip_member('21000000-0000-0000-0000-000000000001'), 'removed member is inactive');
select is((select count(*) from public.trips where id='21000000-0000-0000-0000-000000000001'), 0::bigint, 'removed member cannot read trip');
select is((select count(*) from public.itinerary_days where trip_id='21000000-0000-0000-0000-000000000001'), 0::bigint, 'removed member cannot read shared day');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.email', 'outsider-rls@example.com', true);
select ok(not public.is_trip_member('21000000-0000-0000-0000-000000000001'), 'outsider is not a member');
select is((select count(*) from public.trips where id='21000000-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read trip');
select is((select count(*) from public.trip_members where trip_id='21000000-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read members');
select is((select count(*) from public.audit_events where trip_id='21000000-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read audit history');
select throws_ok($$ select public.create_trip_invite('21000000-0000-0000-0000-000000000001', 'blocked@example.com') $$, '42501', 'Only the trip owner can invite members', 'outsider cannot invite');

select * from finish();
rollback;
