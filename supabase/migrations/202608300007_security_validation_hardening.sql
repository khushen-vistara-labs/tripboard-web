-- Security findings from the production-readiness test matrix.

-- A removed member must not be able to mutate a notification from a trip they
-- can no longer access, even if they retained its UUID on an offline device.
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update
using (user_id = auth.uid() and public.is_trip_member(trip_id))
with check (user_id = auth.uid() and public.is_trip_member(trip_id));

-- Revocation is checked explicitly as well as through expiry. This keeps the
-- security boundary correct even if a future revocation workflow preserves the
-- original expiry for display purposes.
create or replace function public.accept_trip_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_invite public.trip_invites; v_trip_id uuid;
begin
  select * into v_invite
  from public.trip_invites
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
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
