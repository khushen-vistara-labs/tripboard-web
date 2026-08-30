-- Transactional shared-trip setup and owner-only collaboration operations.

alter table public.trip_invites add column revoked_at timestamptz;

create or replace function public.create_shared_trip(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_timezone text,
  p_base_currency text
) returns uuid language plpgsql security definer set search_path = public
as $$
declare v_trip_id uuid; v_date date; v_day integer := 1;
begin
  if auth.uid() is null then raise exception 'Sign in before creating a trip' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'Trip name is required'; end if;
  if p_end_date < p_start_date then raise exception 'Trip end date must be on or after its start date'; end if;
  if p_end_date - p_start_date > 180 then raise exception 'Trips may contain at most 181 days'; end if;
  if p_base_currency !~ '^[A-Z]{3}$' then raise exception 'Base currency must be a three-letter code'; end if;

  insert into public.trips (name, start_date, end_date, timezone, base_currency, owner_id)
  values (trim(p_name), p_start_date, p_end_date, p_timezone, upper(p_base_currency), auth.uid())
  returning id into v_trip_id;

  for v_date in select generate_series(p_start_date, p_end_date, interval '1 day')::date loop
    insert into public.itinerary_days (trip_id, date, title) values (v_trip_id, v_date, 'Day ' || v_day);
    v_day := v_day + 1;
  end loop;
  return v_trip_id;
end;
$$;

create or replace function public.create_trip_invite(p_trip_id uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_token text; v_invite_id uuid;
begin
  if not public.is_trip_owner(p_trip_id) then raise exception 'Only the trip owner can invite members' using errcode = '42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  if exists (
    select 1 from public.trip_members tm join public.profiles p on p.id = tm.user_id
    where tm.trip_id = p_trip_id and tm.removed_at is null and lower(p.email) = v_email
  ) then raise exception 'This person is already a trip member'; end if;

  update public.trip_invites set expires_at = now(), revoked_at = now()
  where trip_id = p_trip_id and lower(email) = v_email and accepted_at is null and expires_at > now();

  v_token := translate(encode(gen_random_bytes(32), 'base64'), E'+/=', '-_');
  insert into public.trip_invites (trip_id, email, token_hash, expires_at, invited_by)
  values (p_trip_id, v_email, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '7 days', auth.uid())
  returning id into v_invite_id;
  return jsonb_build_object('inviteId', v_invite_id, 'token', v_token, 'expiresAt', now() + interval '7 days');
end;
$$;

create or replace function public.remove_trip_member(p_trip_id uuid, p_user_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_member public.trip_members;
begin
  if not public.is_trip_owner(p_trip_id) then raise exception 'Only the trip owner can remove members' using errcode = '42501'; end if;
  select * into v_member from public.trip_members where trip_id = p_trip_id and user_id = p_user_id for update;
  if not found or v_member.removed_at is not null then raise exception 'Active trip member not found'; end if;
  if v_member.role = 'OWNER' then raise exception 'The trip owner cannot be removed'; end if;
  update public.trip_members set removed_at = now() where trip_id = p_trip_id and user_id = p_user_id;
  insert into public.audit_events (trip_id, actor_id, entity_type, entity_id, event_type, before_json, after_json)
  values (p_trip_id, auth.uid(), 'trip_members', p_user_id, 'MEMBER_REMOVED', to_jsonb(v_member),
    jsonb_build_object('user_id', p_user_id, 'removed_at', now(), 'reason', nullif(trim(coalesce(p_reason, '')), '')));
end;
$$;

revoke all on function public.create_shared_trip(text, date, date, text, text) from public;
revoke all on function public.create_trip_invite(uuid, text) from public;
revoke all on function public.remove_trip_member(uuid, uuid, text) from public;
grant execute on function public.create_shared_trip(text, date, date, text, text) to authenticated;
grant execute on function public.create_trip_invite(uuid, text) to authenticated;
grant execute on function public.remove_trip_member(uuid, uuid, text) to authenticated;

-- Active members may identify past actors, including someone later removed.
create policy profiles_trip_audit_actor_read on public.profiles for select
using (
  exists (
    select 1 from public.audit_events ae
    where ae.actor_id = profiles.id and public.is_trip_member(ae.trip_id)
  )
);

alter publication supabase_realtime add table public.trips;
