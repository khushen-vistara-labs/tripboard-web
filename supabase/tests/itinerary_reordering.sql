begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('13000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','order-owner@example.com','',now(),'{}','{}',now(),now()),
  ('13000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','order-member@example.com','',now(),'{}','{}',now(),now()),
  ('13000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','order-outsider@example.com','',now(),'{}','{}',now(),now());
insert into public.trips (id,name,start_date,end_date,timezone,base_currency,owner_id)
values ('23000000-0000-0000-0000-000000000001','Order RLS','2026-12-24','2026-12-25','Asia/Hong_Kong','INR','13000000-0000-0000-0000-000000000001');
insert into public.trip_members (trip_id,user_id,role) values ('23000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000002','MEMBER');
insert into public.itinerary_items (id,trip_id,date,title,sequence) values
  ('33000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000001','2026-12-24','First',0),
  ('33000000-0000-0000-0000-000000000002','23000000-0000-0000-0000-000000000001','2026-12-24','Second',1),
  ('33000000-0000-0000-0000-000000000003','23000000-0000-0000-0000-000000000001','2026-12-25','Tomorrow',0);

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000002',true);
select lives_ok($$ select public.reorder_itinerary_items('23000000-0000-0000-0000-000000000001','2026-12-24',array['33000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000001']::uuid[],'Better walking route') $$, 'member can reorder full day');
select is((select title from public.itinerary_items where date='2026-12-24' order by sequence limit 1), 'Second', 'new order persists');
select is((select change_reason from public.itinerary_items where id='33000000-0000-0000-0000-000000000002'), 'Better walking route', 'reorder reason persists');
select throws_ok($$ select public.reorder_itinerary_items('23000000-0000-0000-0000-000000000001','2026-12-24',array['33000000-0000-0000-0000-000000000001']::uuid[],'Incomplete') $$, 'P0001', 'Reorder list must contain every activity on the day exactly once', 'partial reorder is rejected');
select lives_ok($$ select public.move_itinerary_item('33000000-0000-0000-0000-000000000001','2026-12-25','14:30','Rain in the morning') $$, 'member can move activity');
select is((select date from public.itinerary_items where id='33000000-0000-0000-0000-000000000001'), '2026-12-25'::date, 'move date persists');
select is((select change_reason from public.itinerary_items where id='33000000-0000-0000-0000-000000000001'), 'Rain in the morning', 'move reason persists');

select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000003',true);
select throws_ok($$ select public.reorder_itinerary_items('23000000-0000-0000-0000-000000000001','2026-12-24',array['33000000-0000-0000-0000-000000000002']::uuid[],'Attack') $$, '42501', 'Not authorised for this trip', 'outsider cannot reorder');

select * from finish();
rollback;
