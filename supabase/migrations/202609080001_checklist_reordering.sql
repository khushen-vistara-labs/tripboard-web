-- Shared, persisted ordering for the checklist.

alter table public.checklist_items add column sort_order integer;

with ranked as (
  select id, row_number() over (partition by trip_id order by priority, created_at, id) - 1 as next_sort_order
  from public.checklist_items
)
update public.checklist_items item
set sort_order = ranked.next_sort_order
from ranked
where item.id = ranked.id;

alter table public.checklist_items alter column sort_order set not null;
alter table public.checklist_items alter column sort_order set default 0;

create index checklist_items_trip_sort_order_idx on public.checklist_items (trip_id, sort_order);

create or replace function public.reorder_checklist_items(
  p_trip_id uuid,
  p_item_ids uuid[]
) returns void language plpgsql security definer set search_path = public
as $$
declare v_expected integer; v_supplied integer;
begin
  if not public.is_trip_member(p_trip_id) then raise exception 'Not authorised for this trip' using errcode = '42501'; end if;
  select count(*) into v_expected from public.checklist_items where trip_id = p_trip_id;
  select count(distinct item_id) into v_supplied from unnest(p_item_ids) u(item_id);
  if v_expected <> coalesce(v_supplied, 0) or array_length(p_item_ids, 1) <> v_expected then raise exception 'Reorder list must contain every checklist item exactly once'; end if;
  if exists (select 1 from unnest(p_item_ids) u(item_id) where not exists (select 1 from public.checklist_items i where i.id = u.item_id and i.trip_id = p_trip_id)) then raise exception 'Reorder list contains an item from another trip'; end if;

  update public.checklist_items item set sort_order = ordered.ordinality::integer - 1, updated_by = auth.uid()
  from unnest(p_item_ids) with ordinality ordered(id, ordinality)
  where item.id = ordered.id and item.sort_order is distinct from ordered.ordinality::integer - 1;
end;
$$;

revoke all on function public.reorder_checklist_items(uuid, uuid[]) from public;
grant execute on function public.reorder_checklist_items(uuid, uuid[]) to authenticated;
