-- Direct INR charges are already final own-money outflows.  Persist that fact
-- in the recording RPC and make the reporting view tolerate older records
-- that predate this rule.

create or replace view public.own_money_outflow with (security_invoker = true) as
select t.trip_id,
  sum(case
    when t.transaction_type in ('PURCHASE', 'FUND_WALLET', 'CASH_EXCHANGE')
      and source_account.account_class = 'EXTERNAL_SOURCE'
      then coalesce(t.settled_inr_amount, t.estimated_inr_amount,
        case when t.source_currency = 'INR' then t.source_amount end, 0)
    when t.transaction_type in ('PURCHASE_REFUND', 'FUNDING_REFUND')
      and destination_account.account_class = 'EXTERNAL_SOURCE'
      then -coalesce(t.settled_inr_amount, t.estimated_inr_amount,
        case when t.destination_currency = 'INR' then t.destination_amount end, 0)
    else 0
  end) as inr_amount,
  bool_or(
    t.settled_inr_amount is null
    and t.estimated_inr_amount is not null
    and source_account.account_class = 'EXTERNAL_SOURCE'
  ) as includes_estimates
from public.financial_transactions t
left join public.payment_accounts source_account on source_account.id = t.source_account_id
left join public.payment_accounts destination_account on destination_account.id = t.destination_account_id
where t.voided_at is null
group by t.trip_id;

create or replace function public.create_purchase(
  p_trip_id uuid, p_idempotency_key uuid, p_occurred_at timestamptz, p_description text,
  p_source_account_id uuid, p_amount numeric, p_currency text, p_category text,
  p_merchant text default null, p_estimated_inr_amount numeric default null, p_settled_inr_amount numeric default null,
  p_linked_itinerary_item_id uuid default null, p_linked_place_id uuid default null
) returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare
  v_existing public.financial_transactions;
  v_account public.payment_accounts;
  v_created public.financial_transactions;
  v_settled_inr_amount numeric;
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

  v_settled_inr_amount := coalesce(
    p_settled_inr_amount,
    case when v_account.account_class = 'EXTERNAL_SOURCE' and p_currency = 'INR' then p_amount end
  );

  insert into public.financial_transactions (trip_id, transaction_type, occurred_at, description, merchant, category, source_account_id, source_amount, source_currency, consumption_amount, consumption_currency, estimated_inr_amount, settled_inr_amount, settlement_status, linked_itinerary_item_id, linked_place_id, idempotency_key)
  values (p_trip_id, 'PURCHASE', p_occurred_at, p_description, p_merchant, p_category, p_source_account_id, p_amount, p_currency, p_amount, p_currency, p_estimated_inr_amount, v_settled_inr_amount, case when v_settled_inr_amount is not null then 'SETTLED'::public.settlement_status when p_estimated_inr_amount is not null then 'PROVISIONAL'::public.settlement_status end, p_linked_itinerary_item_id, p_linked_place_id, p_idempotency_key)
  returning * into v_created;
  return v_created;
exception when unique_violation then
  select * into v_existing from public.financial_transactions where trip_id = p_trip_id and idempotency_key = p_idempotency_key;
  return v_existing;
end;
$$;

-- Full-form edits use the same rule, so an older direct-INR transaction
-- becomes settled as soon as it is saved again.
create or replace function public.replace_financial_transaction(
  p_transaction_id uuid,
  p_expected_version integer,
  p_event jsonb
) returns public.financial_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_transaction public.financial_transactions;
  v_source public.payment_accounts;
  v_settled_inr_amount numeric;
begin
  select * into v_transaction from public.financial_transactions where id = p_transaction_id for update;
  if not found or not public.can_access_trip(v_transaction.trip_id) then raise exception 'Transaction not found'; end if;
  if v_transaction.voided_at is not null then raise exception 'Voided transactions cannot be edited'; end if;
  if v_transaction.version <> p_expected_version then raise exception 'Version conflict'; end if;
  if coalesce(nullif(trim(p_event->>'description'), ''), '') = '' then raise exception 'Description is required'; end if;
  if (p_event->>'sourceAmount') is not null and (p_event->>'sourceAmount')::numeric <= 0 then raise exception 'Source amount must be positive'; end if;
  if (p_event->>'destinationAmount') is not null and (p_event->>'destinationAmount')::numeric <= 0 then raise exception 'Destination amount must be positive'; end if;
  if (p_event->>'consumptionAmount') is not null and (p_event->>'consumptionAmount')::numeric <= 0 then raise exception 'Consumption amount must be positive'; end if;
  if (p_event->>'sourceAccountId') is not null and not exists (select 1 from public.payment_accounts where id = (p_event->>'sourceAccountId')::uuid and trip_id = v_transaction.trip_id) then raise exception 'Invalid source account'; end if;
  if (p_event->>'destinationAccountId') is not null and not exists (select 1 from public.payment_accounts where id = (p_event->>'destinationAccountId')::uuid and trip_id = v_transaction.trip_id) then raise exception 'Invalid destination account'; end if;

  select * into v_source from public.payment_accounts where id = nullif(p_event->>'sourceAccountId', '')::uuid;
  v_settled_inr_amount := coalesce(
    nullif(p_event->>'settledInrAmount', '')::numeric,
    case
      when (p_event->>'type') = 'PURCHASE'
        and v_source.account_class = 'EXTERNAL_SOURCE'
        and (p_event->>'sourceCurrency') = 'INR'
        then nullif(p_event->>'sourceAmount', '')::numeric
    end
  );

  update public.financial_transactions set
    transaction_type = (p_event->>'type')::public.financial_event_type,
    occurred_at = (p_event->>'occurredAt')::timestamptz,
    description = trim(p_event->>'description'), merchant = nullif(p_event->>'merchant', ''), category = nullif(p_event->>'category', ''),
    source_account_id = nullif(p_event->>'sourceAccountId', '')::uuid, destination_account_id = nullif(p_event->>'destinationAccountId', '')::uuid,
    source_amount = nullif(p_event->>'sourceAmount', '')::numeric, source_currency = nullif(p_event->>'sourceCurrency', ''),
    destination_amount = nullif(p_event->>'destinationAmount', '')::numeric, destination_currency = nullif(p_event->>'destinationCurrency', ''),
    consumption_amount = nullif(p_event->>'consumptionAmount', '')::numeric, consumption_currency = nullif(p_event->>'consumptionCurrency', ''),
    estimated_inr_amount = nullif(p_event->>'estimatedInrAmount', '')::numeric, settled_inr_amount = v_settled_inr_amount,
    settlement_status = case when v_settled_inr_amount is not null then 'SETTLED'::public.settlement_status when nullif(p_event->>'estimatedInrAmount', '') is not null then 'PROVISIONAL'::public.settlement_status end,
    original_transaction_id = nullif(p_event->>'originalTransactionId', '')::uuid,
    version = version + 1, updated_by = auth.uid(), updated_at = now()
  where id = p_transaction_id returning * into v_transaction;
  return v_transaction;
end;
$$;
