begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('15000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','invite-owner@example.com','',now(),'{}','{}',now(),now()),
  ('15000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','invited@example.com','',now(),'{}','{}',now(),now()),
  ('15000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','wrong@example.com','',now(),'{}','{}',now(),now());

insert into public.trips (id,name,start_date,end_date,timezone,base_currency,owner_id)
values ('25000000-0000-0000-0000-000000000001','Invite security','2026-12-24','2026-12-25','Asia/Kolkata','INR','15000000-0000-0000-0000-000000000001');

insert into public.trip_invites (id,trip_id,email,token_hash,created_at,expires_at,revoked_at,invited_by)
values
  ('35000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001','invited@example.com',encode(digest('valid-token','sha256'),'hex'),now(),now()+interval '7 days',null,'15000000-0000-0000-0000-000000000001'),
  ('35000000-0000-0000-0000-000000000002','25000000-0000-0000-0000-000000000001','invited@example.com',encode(digest('expired-token','sha256'),'hex'),now()-interval '2 days',now()-interval '1 day',null,'15000000-0000-0000-0000-000000000001'),
  ('35000000-0000-0000-0000-000000000003','25000000-0000-0000-0000-000000000001','invited@example.com',encode(digest('revoked-token','sha256'),'hex'),now(),now()+interval '7 days',now(),'15000000-0000-0000-0000-000000000001');

select isnt(
  (select token_hash from public.trip_invites where id='35000000-0000-0000-0000-000000000001'),
  'valid-token',
  'raw invite tokens are never stored'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claim.email','wrong@example.com',true);
select throws_ok(
  $$ select public.accept_trip_invite('valid-token') $$,
  'P0001',
  'Sign in with the invited email address',
  'an invite cannot be accepted by the wrong email'
);

select set_config('request.jwt.claim.sub','15000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.email','invited@example.com',true);
select throws_ok($$ select public.accept_trip_invite('expired-token') $$, 'P0001', 'Invitation is invalid or expired', 'an expired invite is rejected');
select throws_ok($$ select public.accept_trip_invite('revoked-token') $$, 'P0001', 'Invitation is invalid or expired', 'a revoked invite is rejected');
select is(public.accept_trip_invite('valid-token'), '25000000-0000-0000-0000-000000000001'::uuid, 'a valid invite returns its trip');
select is(
  (select count(*) from public.trip_members where trip_id='25000000-0000-0000-0000-000000000001' and user_id='15000000-0000-0000-0000-000000000002' and removed_at is null),
  1::bigint,
  'acceptance creates one active membership'
);
select ok((select accepted_at is not null from public.trip_invites where id='35000000-0000-0000-0000-000000000001'), 'acceptance consumes the invite');
select throws_ok($$ select public.accept_trip_invite('valid-token') $$, 'P0001', 'Invitation is invalid or expired', 'an accepted invite cannot be reused');

select * from finish();
rollback;
