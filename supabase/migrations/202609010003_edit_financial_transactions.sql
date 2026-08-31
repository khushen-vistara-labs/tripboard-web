-- Permit a member to correct a recorded amount or description without changing
-- its payment-account/currency structure. That preserves ledger invariants.
create or replace function public.edit_financial_transaction(
  p_transaction_id uuid,
  p_expected_version integer,
  p_description text,
  p_category text,
  p_source_amount numeric,
  p_destination_amount numeric,
  p_consumption_amount numeric
) returns public.financial_transactions
language plpgsql security definer set search_path = public as $$
declare v_transaction public.financial_transactions;
begin
  select * into v_transaction from public.financial_transactions where id = p_transaction_id for update;
  if not found or not public.can_access_trip(v_transaction.trip_id) then raise exception 'Transaction not found'; end if;
  if v_transaction.voided_at is not null then raise exception 'Voided transactions cannot be edited'; end if;
  if v_transaction.version <> p_expected_version then raise exception 'Version conflict'; end if;
  if coalesce(nullif(trim(p_description), ''), '') = '' then raise exception 'Description is required'; end if;
  if p_source_amount is not null and p_source_amount <= 0 then raise exception 'Source amount must be positive'; end if;
  if p_destination_amount is not null and p_destination_amount <= 0 then raise exception 'Destination amount must be positive'; end if;
  if p_consumption_amount is not null and p_consumption_amount <= 0 then raise exception 'Consumption amount must be positive'; end if;
  update public.financial_transactions set
    description = trim(p_description), category = case when v_transaction.transaction_type = 'PURCHASE' then p_category else category end,
    source_amount = p_source_amount, destination_amount = p_destination_amount, consumption_amount = p_consumption_amount,
    version = version + 1, updated_by = auth.uid(), updated_at = now()
  where id = p_transaction_id returning * into v_transaction;
  return v_transaction;
end;
$$;

revoke all on function public.edit_financial_transaction(uuid, integer, text, text, numeric, numeric, numeric) from public;
grant execute on function public.edit_financial_transaction(uuid, integer, text, text, numeric, numeric, numeric) to authenticated;
