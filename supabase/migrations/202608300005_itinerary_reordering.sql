-- Persisted, auditable itinerary movement and reordering.

alter table public.itinerary_items add column change_reason text;

create or replace function public.move_itinerary_item(
  p_item_id uuid,
  p_date date,
  p_time time,
  p_reason text
) returns public.itinerary_items language plpgsql security definer set search_path = public
as $$
declare v_item public.itinerary_items; v_sequence integer;
begin
  select * into v_item from public.itinerary_items where id = p_item_id for update;
  if not found or not public.is_trip_member(v_item.trip_id) then raise exception 'Activity not found or not authorised' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A move reason is required'; end if;
  select coalesce(max(sequence), -1) + 1 into v_sequence from public.itinerary_items where trip_id = v_item.trip_id and date = p_date and id <> p_item_id;
  update public.itinerary_items set date = p_date, planned_start_time = p_time, sequence = v_sequence,
    status = 'MOVED', change_reason = trim(p_reason), updated_by = auth.uid()
  where id = p_item_id returning * into v_item;
  return v_item;
end;
$$;

create or replace function public.reorder_itinerary_items(
  p_trip_id uuid,
  p_date date,
  p_item_ids uuid[],
  p_reason text
) returns void language plpgsql security definer set search_path = public
as $$
declare v_expected integer; v_supplied integer;
begin
  if not public.is_trip_member(p_trip_id) then raise exception 'Not authorised for this trip' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A reorder reason is required'; end if;
  select count(*) into v_expected from public.itinerary_items where trip_id = p_trip_id and date = p_date;
  select count(distinct item_id) into v_supplied from unnest(p_item_ids) u(item_id);
  if v_expected <> coalesce(v_supplied, 0) or array_length(p_item_ids, 1) <> v_expected then raise exception 'Reorder list must contain every activity on the day exactly once'; end if;
  if exists (select 1 from unnest(p_item_ids) u(item_id) where not exists (select 1 from public.itinerary_items i where i.id = u.item_id and i.trip_id = p_trip_id and i.date = p_date)) then raise exception 'Reorder list contains an activity from another day or trip'; end if;

  update public.itinerary_items i set sequence = ordered.ordinality::integer - 1,
    change_reason = trim(p_reason), updated_by = auth.uid()
  from unnest(p_item_ids) with ordinality ordered(id, ordinality)
  where i.id = ordered.id and i.sequence is distinct from ordered.ordinality::integer - 1;
end;
$$;

revoke all on function public.move_itinerary_item(uuid, date, time, text) from public;
revoke all on function public.reorder_itinerary_items(uuid, date, uuid[], text) from public;
grant execute on function public.move_itinerary_item(uuid, date, time, text) to authenticated;
grant execute on function public.reorder_itinerary_items(uuid, date, uuid[], text) to authenticated;
