begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('12000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','storage-owner@example.com','',now(),'{}','{}',now(),now()),
  ('12000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','storage-member@example.com','',now(),'{}','{}',now(),now()),
  ('12000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','storage-removed@example.com','',now(),'{}','{}',now(),now()),
  ('12000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','storage-outsider@example.com','',now(),'{}','{}',now(),now());
insert into public.trips (id,name,start_date,end_date,timezone,base_currency,owner_id)
values ('22000000-0000-0000-0000-000000000001','Storage RLS','2026-12-24','2026-12-25','Asia/Hong_Kong','INR','12000000-0000-0000-0000-000000000001');
insert into public.trip_members (trip_id,user_id,role,removed_at) values
  ('22000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000002','MEMBER',null),
  ('22000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000003','MEMBER',now());
insert into public.bookings (id,trip_id,type,title,status,created_by,updated_by)
values ('32000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','HOTEL','Private booking','CONFIRMED','12000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001');
insert into public.booking_files (id,trip_id,booking_id,storage_path,filename,mime_type,file_size,created_by)
values ('32000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001/booking/test-ticket.pdf','test-ticket.pdf','application/pdf',100,'12000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id,name) values
  ('booking-documents','22000000-0000-0000-0000-000000000001/booking/test-ticket.pdf'),
  ('booking-documents','99999999-0000-0000-0000-000000000999/booking/unrelated.pdf');

select is((select public from storage.buckets where id='booking-documents'), false, 'booking bucket is private');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'booking_documents_member_%'), 3::bigint, 'read, insert, and delete policies exist');

set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000001',true);
select is((select count(*) from storage.objects where bucket_id='booking-documents'), 1::bigint, 'owner sees only own trip file');

select set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000002',true);
select is((select count(*) from storage.objects where bucket_id='booking-documents'), 1::bigint, 'active member sees trip file');
select lives_ok($$ insert into storage.objects (bucket_id,name) values ('booking-documents','22000000-0000-0000-0000-000000000001/booking/member-upload.pdf') $$, 'active member may upload private file');
select is((select count(*) from storage.objects where bucket_id='booking-documents'), 2::bigint, 'member sees uploaded file');
select lives_ok($$ delete from storage.objects where name='22000000-0000-0000-0000-000000000001/booking/member-upload.pdf' $$, 'active member may delete private file');

select set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000003',true);
select is((select count(*) from storage.objects where bucket_id='booking-documents'), 0::bigint, 'removed member cannot read files');
select ok(not public.is_trip_member('22000000-0000-0000-0000-000000000001'), 'removed member no longer passes membership check');
select is_empty($$ delete from storage.objects where name='22000000-0000-0000-0000-000000000001/booking/test-ticket.pdf' returning name $$, 'removed member cannot delete a retained private object path');
select throws_ok($$ select public.delete_booking_file_metadata('32000000-0000-0000-0000-000000000002') $$, '42501', 'Not authorised for this trip', 'removed member cannot delete booking-file metadata');

select set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000004',true);
select is((select count(*) from storage.objects where bucket_id='booking-documents'), 0::bigint, 'unrelated user cannot read files');
select is_empty($$ delete from storage.objects where name='22000000-0000-0000-0000-000000000001/booking/test-ticket.pdf' returning name $$, 'unrelated user cannot delete a private object path');
select throws_ok($$ select public.delete_booking_file_metadata('32000000-0000-0000-0000-000000000002') $$, '42501', 'Not authorised for this trip', 'unrelated user cannot delete booking-file metadata');

select * from finish();
rollback;
