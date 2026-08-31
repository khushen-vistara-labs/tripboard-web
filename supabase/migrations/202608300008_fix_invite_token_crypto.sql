-- Supabase installs pgcrypto in the extensions schema. The invite function is
-- security definer with a public-only search path, so qualify crypto calls.

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

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=', '-_');
  insert into public.trip_invites (trip_id, email, token_hash, expires_at, invited_by)
  values (p_trip_id, v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days', auth.uid())
  returning id into v_invite_id;
  return jsonb_build_object('inviteId', v_invite_id, 'token', v_token, 'expiresAt', now() + interval '7 days');
end;
$$;

revoke all on function public.create_trip_invite(uuid, text) from public;
grant execute on function public.create_trip_invite(uuid, text) to authenticated;

create or replace function public.accept_trip_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_invite public.trip_invites; v_trip_id uuid;
begin
  select * into v_invite
  from public.trip_invites
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if not found
    or v_invite.expires_at <= now()
    or v_invite.accepted_at is not null
    or v_invite.revoked_at is not null
  then
    raise exception 'Invitation is invalid or expired';
  end if;

  if lower(v_invite.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Sign in with the invited email address';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, auth.uid(), 'MEMBER')
  on conflict (trip_id, user_id) do update set removed_at = null, joined_at = now();

  update public.trip_invites set accepted_at = now() where id = v_invite.id;
  v_trip_id := v_invite.trip_id;
  return v_trip_id;
end;
$$;

revoke all on function public.accept_trip_invite(text) from public;
grant execute on function public.accept_trip_invite(text) to authenticated;
