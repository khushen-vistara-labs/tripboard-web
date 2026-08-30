begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('14000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','version-owner@example.com','',now(),'{}','{}',now(),now()),
  ('14000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','version-member@example.com','',now(),'{}','{}',now(),now());

insert into public.trips (id,name,start_date,end_date,timezone,base_currency,owner_id)
values ('24000000-0000-0000-0000-000000000001','Offline version test','2026-12-24','2026-12-25','Asia/Kolkata','INR','14000000-0000-0000-0000-000000000001');
insert into public.trip_members (trip_id,user_id,role)
values ('24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002','MEMBER');
insert into public.places (id,trip_id,name,priority)
values ('34000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001','Original place','NICE_TO_HAVE');

select is((select version from public.places where id='34000000-0000-0000-0000-000000000001'), 1, 'shared records start at version one');
update public.places set name='Changed elsewhere' where id='34000000-0000-0000-0000-000000000001';
select is((select version from public.places where id='34000000-0000-0000-0000-000000000001'), 2, 'an edit advances the concurrency version');
select is((select count(*)::integer from public.places where id='34000000-0000-0000-0000-000000000001' and version=1), 0, 'a stale conditional update cannot match the record');

set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-0000-0000-000000000001',true);
select throws_ok(
  $$ select public.remove_trip_member_versioned('24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002',2,'stale removal') $$,
  '40001',
  'Version conflict: member access changed on another device',
  'member removal rejects a stale version'
);
select lives_ok(
  $$ select public.remove_trip_member_versioned('24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002',1,'trip changed') $$,
  'member removal accepts the current version'
);
select ok(
  (select removed_at is not null from public.trip_members where trip_id='24000000-0000-0000-0000-000000000001' and user_id='14000000-0000-0000-0000-000000000002'),
  'successful removal revokes access without deleting membership history'
);

select * from finish();
rollback;
