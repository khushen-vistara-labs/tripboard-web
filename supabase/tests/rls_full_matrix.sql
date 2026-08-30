begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('16000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','matrix-owner@example.com','',now(),'{}','{}',now(),now()),
  ('16000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','matrix-member@example.com','',now(),'{}','{}',now(),now()),
  ('16000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','matrix-removed@example.com','',now(),'{}','{}',now(),now()),
  ('16000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','matrix-outsider@example.com','',now(),'{}','{}',now(),now());

insert into public.trips (id,name,start_date,end_date,timezone,base_currency,owner_id)
values ('26000000-0000-0000-0000-000000000001','Full RLS matrix','2026-12-24','2026-12-25','Asia/Kolkata','INR','16000000-0000-0000-0000-000000000001');
insert into public.trip_members (trip_id,user_id,role,removed_at) values
  ('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000002','MEMBER',null),
  ('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000003','MEMBER',now());
insert into public.trip_invites (id,trip_id,email,token_hash,expires_at,invited_by)
values ('36000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','future@example.com',encode(digest('matrix-token','sha256'),'hex'),now()+interval '7 days','16000000-0000-0000-0000-000000000001');
insert into public.itinerary_days (id,trip_id,date,title) values ('36000000-0000-0000-0000-000000000002','26000000-0000-0000-0000-000000000001','2026-12-24','Arrival');
insert into public.places (id,trip_id,name,priority) values ('36000000-0000-0000-0000-000000000003','26000000-0000-0000-0000-000000000001','Matrix place','WANT');
insert into public.payment_accounts (id,trip_id,name,account_class,account_type,currency,opening_balance) values ('36000000-0000-0000-0000-000000000004','26000000-0000-0000-0000-000000000001','Matrix wallet','STORED_VALUE','WALLET','INR',1000);
insert into public.bookings (id,trip_id,type,title,status,created_by,updated_by) values ('36000000-0000-0000-0000-000000000005','26000000-0000-0000-0000-000000000001','HOTEL','Matrix booking','CONFIRMED','16000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001');
insert into public.checklist_items (id,trip_id,title,kind,created_by,updated_by) values ('36000000-0000-0000-0000-000000000006','26000000-0000-0000-0000-000000000001','Matrix checklist','OTHER','16000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001');
insert into public.itinerary_items (id,trip_id,itinerary_day_id,date,title,created_by,updated_by) values ('36000000-0000-0000-0000-000000000007','26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000002','2026-12-24','Matrix activity','16000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001');
insert into public.booking_files (id,trip_id,booking_id,storage_path,filename,mime_type,file_size,created_by) values ('36000000-0000-0000-0000-000000000008','26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000005','26000000-0000-0000-0000-000000000001/booking/matrix.pdf','matrix.pdf','application/pdf',100,'16000000-0000-0000-0000-000000000001');
insert into public.financial_transactions (id,trip_id,transaction_type,occurred_at,description,source_account_id,source_amount,source_currency,consumption_amount,consumption_currency,idempotency_key,created_by,updated_by) values ('36000000-0000-0000-0000-000000000009','26000000-0000-0000-0000-000000000001','PURCHASE',now(),'Matrix purchase','36000000-0000-0000-0000-000000000004',10,'INR',10,'INR','46000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001');
insert into public.budgets (id,trip_id,amount,currency,budget_scope) values ('36000000-0000-0000-0000-000000000010','26000000-0000-0000-0000-000000000001',500,'INR','TRIP');
insert into public.budget_notification_state (budget_id,threshold) values ('36000000-0000-0000-0000-000000000010',80);
insert into public.exchange_rates (id,trip_id,from_currency,to_currency,rate,source,effective_at) values ('36000000-0000-0000-0000-000000000011','26000000-0000-0000-0000-000000000001','INR','HKD',0.09,'test',now());
insert into public.notification_preferences (user_id,trip_id) values
  ('16000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001'),
  ('16000000-0000-0000-0000-000000000002','26000000-0000-0000-0000-000000000001'),
  ('16000000-0000-0000-0000-000000000003','26000000-0000-0000-0000-000000000001');
insert into public.notifications (id,trip_id,user_id,type,title,body,dedupe_key) values
  ('36000000-0000-0000-0000-000000000012','26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','SYNC','Owner notice','Test','matrix-owner'),
  ('36000000-0000-0000-0000-000000000013','26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000002','SYNC','Member notice','Test','matrix-member'),
  ('36000000-0000-0000-0000-000000000014','26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000003','SYNC','Removed notice','Test','matrix-removed');
insert into public.push_subscriptions (id,user_id,endpoint,p256dh,auth) values
  ('36000000-0000-0000-0000-000000000015','16000000-0000-0000-0000-000000000001','https://push.example/owner','key','auth'),
  ('36000000-0000-0000-0000-000000000016','16000000-0000-0000-0000-000000000002','https://push.example/member','key','auth'),
  ('36000000-0000-0000-0000-000000000017','16000000-0000-0000-0000-000000000003','https://push.example/removed','key','auth'),
  ('36000000-0000-0000-0000-000000000018','16000000-0000-0000-0000-000000000004','https://push.example/outsider','key','auth');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','trips','trip_members','trip_invites','itinerary_days','itinerary_items','places','checklist_items','bookings','booking_files','payment_accounts','financial_transactions','budgets','budget_notification_state','exchange_rates','notification_preferences','notifications','push_subscriptions','audit_events') and c.relrowsecurity),
  19::bigint,
  'RLS is enabled on every application table'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000001',true);
select ok(
  (select count(*)=1 from public.trips) and (select count(*)=3 from public.trip_members) and (select count(*)=1 from public.trip_invites)
  and (select count(*)=1 from public.itinerary_days) and (select count(*)=1 from public.itinerary_items) and (select count(*)=1 from public.places)
  and (select count(*)=1 from public.checklist_items) and (select count(*)=1 from public.bookings) and (select count(*)=1 from public.booking_files)
  and (select count(*)=1 from public.payment_accounts) and (select count(*)=1 from public.financial_transactions) and (select count(*)=1 from public.budgets)
  and (select count(*)=1 from public.budget_notification_state) and (select count(*)=1 from public.exchange_rates)
  and (select count(*)=1 from public.notification_preferences) and (select count(*)=1 from public.notifications) and (select count(*)=1 from public.push_subscriptions)
  and (select count(*)>0 from public.audit_events),
  'owner reads all shared data, owner-only invites, personal alerts, and audit history'
);
select lives_ok($$ update public.trips set name='Owner updated trip' where id='26000000-0000-0000-0000-000000000001' $$, 'owner may update trip settings');

select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000002',true);
select ok(
  (select count(*)=1 from public.trips) and (select count(*)=3 from public.trip_members) and (select count(*)=0 from public.trip_invites)
  and (select count(*)=1 from public.itinerary_days) and (select count(*)=1 from public.itinerary_items) and (select count(*)=1 from public.places)
  and (select count(*)=1 from public.checklist_items) and (select count(*)=1 from public.bookings) and (select count(*)=1 from public.booking_files)
  and (select count(*)=1 from public.payment_accounts) and (select count(*)=1 from public.financial_transactions) and (select count(*)=1 from public.budgets)
  and (select count(*)=1 from public.budget_notification_state) and (select count(*)=1 from public.exchange_rates)
  and (select count(*)=1 from public.notification_preferences) and (select count(*)=1 from public.notifications) and (select count(*)=1 from public.push_subscriptions)
  and (select count(*)>0 from public.audit_events),
  'member reads shared data and only their own alert records'
);
select lives_ok($$ update public.places set notes='Member edit' where id='36000000-0000-0000-0000-000000000003' $$, 'member may edit shared trip content');

select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000003',true);
select ok(
  (select count(*)=0 from public.trips) and (select count(*)=0 from public.trip_members) and (select count(*)=0 from public.trip_invites)
  and (select count(*)=0 from public.itinerary_days) and (select count(*)=0 from public.itinerary_items) and (select count(*)=0 from public.places)
  and (select count(*)=0 from public.checklist_items) and (select count(*)=0 from public.bookings) and (select count(*)=0 from public.booking_files)
  and (select count(*)=0 from public.payment_accounts) and (select count(*)=0 from public.financial_transactions) and (select count(*)=0 from public.budgets)
  and (select count(*)=0 from public.budget_notification_state) and (select count(*)=0 from public.exchange_rates)
  and (select count(*)=0 from public.notification_preferences) and (select count(*)=0 from public.notifications) and (select count(*)=1 from public.push_subscriptions)
  and (select count(*)=0 from public.audit_events),
  'removed member loses every trip-bound read while retaining only their personal push record'
);
select is_empty($$ update public.notifications set read_at=now() where id='36000000-0000-0000-0000-000000000014' returning id $$, 'removed member cannot update a retained notification UUID');

select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000004',true);
select ok(
  (select count(*)=0 from public.trips) and (select count(*)=0 from public.trip_members) and (select count(*)=0 from public.trip_invites)
  and (select count(*)=0 from public.itinerary_days) and (select count(*)=0 from public.itinerary_items) and (select count(*)=0 from public.places)
  and (select count(*)=0 from public.checklist_items) and (select count(*)=0 from public.bookings) and (select count(*)=0 from public.booking_files)
  and (select count(*)=0 from public.payment_accounts) and (select count(*)=0 from public.financial_transactions) and (select count(*)=0 from public.budgets)
  and (select count(*)=0 from public.budget_notification_state) and (select count(*)=0 from public.exchange_rates)
  and (select count(*)=0 from public.notification_preferences) and (select count(*)=0 from public.notifications) and (select count(*)=1 from public.push_subscriptions)
  and (select count(*)=0 from public.audit_events),
  'outsider cannot read any trip-bound record'
);
select is_empty($$ update public.places set notes='Blocked outsider edit' where id='36000000-0000-0000-0000-000000000003' returning id $$, 'outsider cannot edit a retained place UUID');

select * from finish();
rollback;
