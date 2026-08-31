-- Full-form money edits: keep the transaction identity/audit trail, while
-- allowing the same fields available when recording a new activity.
create or replace function public.replace_financial_transaction(
  p_transaction_id uuid,
  p_expected_version integer,
  p_event jsonb
) returns public.financial_transactions
language plpgsql security definer set search_path = public as $$
declare v_transaction public.financial_transactions;
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

  update public.financial_transactions set
    transaction_type = (p_event->>'type')::public.financial_event_type,
    occurred_at = (p_event->>'occurredAt')::timestamptz,
    description = trim(p_event->>'description'), merchant = nullif(p_event->>'merchant', ''), category = nullif(p_event->>'category', ''),
    source_account_id = nullif(p_event->>'sourceAccountId', '')::uuid, destination_account_id = nullif(p_event->>'destinationAccountId', '')::uuid,
    source_amount = nullif(p_event->>'sourceAmount', '')::numeric, source_currency = nullif(p_event->>'sourceCurrency', ''),
    destination_amount = nullif(p_event->>'destinationAmount', '')::numeric, destination_currency = nullif(p_event->>'destinationCurrency', ''),
    consumption_amount = nullif(p_event->>'consumptionAmount', '')::numeric, consumption_currency = nullif(p_event->>'consumptionCurrency', ''),
    estimated_inr_amount = nullif(p_event->>'estimatedInrAmount', '')::numeric, settled_inr_amount = nullif(p_event->>'settledInrAmount', '')::numeric,
    settlement_status = nullif(p_event->>'settlementStatus', '')::public.settlement_status,
    original_transaction_id = nullif(p_event->>'originalTransactionId', '')::uuid,
    version = version + 1, updated_by = auth.uid(), updated_at = now()
  where id = p_transaction_id returning * into v_transaction;
  return v_transaction;
end;
$$;

revoke all on function public.replace_financial_transaction(uuid, integer, jsonb) from public;
grant execute on function public.replace_financial_transaction(uuid, integer, jsonb) to authenticated;
