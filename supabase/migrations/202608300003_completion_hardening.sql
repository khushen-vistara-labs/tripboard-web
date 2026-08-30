-- Remaining collaboration, audit, and operational safeguards.
-- This migration is additive and can be applied after the foundation schema.

-- Include every shared record that people can change in the visible history.
create or replace function public.audit_trip_record()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.audit_events (trip_id, actor_id, entity_type, entity_id, event_type, before_json, after_json)
  values (coalesce(new.id, old.id), auth.uid(), tg_table_name, coalesce(new.id, old.id), tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end; $$;
create or replace function public.audit_trip_membership_change()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.audit_events (trip_id, actor_id, entity_type, entity_id, event_type, before_json, after_json)
  values (coalesce(new.trip_id, old.trip_id), auth.uid(), tg_table_name, coalesce(new.user_id, old.user_id), tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end; $$;
create trigger trips_audit after update on public.trips for each row execute function public.audit_trip_record();
create trigger itinerary_days_audit after insert or update or delete on public.itinerary_days for each row execute function public.audit_trip_change();
create trigger places_audit after insert or update or delete on public.places for each row execute function public.audit_trip_change();
create trigger trip_members_audit after insert or update or delete on public.trip_members for each row execute function public.audit_trip_membership_change();
create trigger trip_invites_audit after insert or update or delete on public.trip_invites for each row execute function public.audit_trip_change();
create trigger payment_accounts_audit after insert or update on public.payment_accounts for each row execute function public.audit_trip_change();
create trigger budgets_audit after insert or update or delete on public.budgets for each row execute function public.audit_trip_change();

-- A correction is a void, never a destructive rewrite of financial history.
create or replace function public.void_financial_transaction(p_transaction_id uuid, p_expected_version integer, p_reason text)
returns public.financial_transactions language plpgsql security definer set search_path = public
as $$
declare v_transaction public.financial_transactions;
begin
  select * into v_transaction from public.financial_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  perform public.assert_financial_member(v_transaction.trip_id);
  if v_transaction.version <> p_expected_version then raise exception 'Version conflict: reload before editing' using errcode = '40001'; end if;
  if v_transaction.voided_at is not null then return v_transaction; end if;
  if char_length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A reason is required to void a transaction'; end if;
  update public.financial_transactions
    set voided_at = now(), description = description || ' [VOID: ' || trim(p_reason) || ']', version = version + 1,
      updated_by = auth.uid(), updated_at = now()
    where id = p_transaction_id returning * into v_transaction;
  return v_transaction;
end;
$$;
revoke all on function public.void_financial_transaction(uuid, integer, text) from public;
grant execute on function public.void_financial_transaction(uuid, integer, text) to authenticated;

-- One RPC ensures a booking file's private object and metadata are removed together.
-- The client deletes the object first; a failed metadata delete leaves it inaccessible,
-- and a scheduled storage cleanup can safely remove orphaned paths.
create or replace function public.delete_booking_file_metadata(p_file_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare v_file public.booking_files;
begin
  select * into v_file from public.booking_files where id = p_file_id for update;
  if not found then raise exception 'Booking file not found'; end if;
  if not public.is_trip_member(v_file.trip_id) then raise exception 'Not authorised for this trip' using errcode = '42501'; end if;
  delete from public.booking_files where id = p_file_id;
  return v_file.storage_path;
end;
$$;
revoke all on function public.delete_booking_file_metadata(uuid) from public;
grant execute on function public.delete_booking_file_metadata(uuid) to authenticated;

alter publication supabase_realtime add table public.itinerary_days, public.budgets, public.audit_events;
