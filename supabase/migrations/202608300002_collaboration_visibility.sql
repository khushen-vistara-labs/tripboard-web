-- Active trip members may see the minimal profile data needed to identify
-- collaborators.  The original self-only profile policy prevented the member
-- list from rendering real names or email addresses.
create policy profiles_trip_member_read on public.profiles for select
using (
  exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid()
      and mine.removed_at is null
      and theirs.user_id = profiles.id
      and theirs.removed_at is null
  )
);

alter publication supabase_realtime add table public.trip_members, public.trip_invites, public.places, public.notification_preferences;
