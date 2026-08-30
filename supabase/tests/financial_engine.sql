begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.com', '', now(), '{}', '{}', now(), now());

insert into public.trips (id, name, start_date, end_date, timezone, base_currency, owner_id)
values ('20000000-0000-0000-0000-000000000001', 'Test trip', '2026-12-24', '2027-01-03', 'Asia/Hong_Kong', 'INR', '10000000-0000-0000-0000-000000000001');

insert into public.payment_accounts (id, trip_id, name, account_class, account_type, currency)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'HDFC', 'EXTERNAL_SOURCE', 'CREDIT_CARD', 'INR'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Octopus 1', 'STORED_VALUE', 'OCTOPUS', 'HKD'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'HKD Cash', 'STORED_VALUE', 'CASH', 'HKD');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select lives_ok($$ select public.fund_wallet('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',now(),'Top up','30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',500,'HKD',5500,5500) $$, 'wallet funding succeeds');
select is(public.stored_value_balance('30000000-0000-0000-0000-000000000002'), 500::numeric, 'top-up credits Octopus');
select is((select inr_amount from public.own_money_outflow where trip_id='20000000-0000-0000-0000-000000000001'), 5500::numeric, 'top-up records own-money outflow');
select is((select coalesce(sum(amount),0) from public.local_consumption_by_category where trip_id='20000000-0000-0000-0000-000000000001'), 0::numeric, 'top-up is not consumption');

select lives_ok($$ select public.create_purchase('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',now(),'MTR','30000000-0000-0000-0000-000000000002',20,'HKD','Transport') $$, 'wallet purchase succeeds');
select is(public.stored_value_balance('30000000-0000-0000-0000-000000000002'), 480::numeric, 'purchase debits wallet');
select is((select amount from public.local_consumption_by_category where trip_id='20000000-0000-0000-0000-000000000001' and category='Transport'), 20::numeric, 'purchase increases transport consumption');
select is((select inr_amount from public.own_money_outflow where trip_id='20000000-0000-0000-0000-000000000001'), 5500::numeric, 'wallet purchase does not increase outflow');

select lives_ok($$ select public.create_purchase('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',now(),'MTR','30000000-0000-0000-0000-000000000002',20,'HKD','Transport') $$, 'duplicate idempotency replay succeeds');
select is((select count(*) from public.financial_transactions where idempotency_key='40000000-0000-0000-0000-000000000002'), 1::bigint, 'duplicate replay inserts once');
select throws_ok($$ select public.create_purchase('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003',now(),'Impossible','30000000-0000-0000-0000-000000000002',900,'HKD','Transport') $$, 'P0001', 'Not enough balance in Octopus 1', 'negative wallet balance is rejected');

select lives_ok($$ select public.create_balance_adjustment('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004',now(),'Reconcile','30000000-0000-0000-0000-000000000002',-6,'HKD') $$, 'balance correction succeeds');
select is(public.stored_value_balance('30000000-0000-0000-0000-000000000002'), 474::numeric, 'balance correction changes only wallet balance');

select * from finish();
rollback;
