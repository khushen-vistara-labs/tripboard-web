# TripBoard production validation

Use a dedicated validation trip rather than the real travel plan. Keep both test accounts afterward, but delete the validation trip and uploaded test files when sign-off is complete.

## 1. Local automated security checks

1. Install and start Docker Desktop or Podman.
2. Run `supabase start`.
3. Run `supabase db reset` to apply every migration to the disposable local database.
4. Run `pnpm test:db`.
5. Run `pnpm check`.
6. Install the Playwright browsers once with `pnpm exec playwright install`, then run `pnpm test:e2e`.

The database suite covers owner, member, removed-member, and outsider access; private booking files; invite expiry, wrong-email acceptance, revocation, reuse prevention; financial idempotency; and offline version conflicts.

## 2. Apply the single Supabase project

Do this only after the remaining feature work is finished.

1. Take a database backup from Supabase.
2. Review the pending migration list.
3. Run `supabase db push` once to apply the prepared migrations in order.
4. Run the non-destructive smoke checks against the deployed app.
5. Do not point automated fixture-producing database tests at production.

## 3. Authentication and invitation sign-off

- Owner signs in, closes the PWA/browser completely, reopens it, and remains signed in.
- Member repeats the persistent-session check on the other phone.
- Owner requests password recovery and confirms that the recovery link opens the deployed `/login` page and allows a new password.
- Owner creates a fresh invitation for the member email.
- A different signed-in email cannot accept the invitation.
- The correct account accepts it once; opening the same link again fails.
- Owner revokes an unused invitation and confirms it can no longer be accepted.
- Owner removes the member from the validation trip; the member immediately loses trip and file access while audit history remains.

## 4. Private booking-file sign-off

- Owner uploads a small PDF and image to a validation booking.
- Both active accounts can open the signed file link.
- An unrelated account cannot open the object URL or metadata.
- Replace a file and verify the old object disappears from the private bucket.
- Delete a file and verify both storage object and metadata disappear.
- Remove the member and verify previously opened file links expire and new signed links cannot be created.

## 5. Two-user real-time and conflict sign-off

- Keep the same validation trip open on both phones.
- Add/edit places, bookings, itinerary, checklist, accounts, budgets, settings, members, and alert preferences on one phone; confirm the other refreshes without reloading.
- Put one phone offline, edit a shared record there, then edit the same record online on the other phone.
- Reconnect the offline phone and confirm **Conflict needs review** appears.
- Test **Retry** after reviewing the current record, then repeat and test **Discard and restore**.
- Reject one optimistic change through permissions/removal and verify the server copy is restored.

## 6. iPhone and Android PWA sign-off

On both devices:

- Install the PWA and launch it from the home screen.
- Verify portrait layouts, keyboard navigation where available, focus visibility, labels, contrast, and touch targets.
- Open key screens once, enable airplane mode, relaunch, and verify the cached trip opens.
- Make offline itinerary/checklist/place changes, reconnect, and verify they sync once.
- Deploy a visible harmless text change, close/reopen the PWA, and verify the update arrives.
- Check notification permission before prompting, after allow, and after deny.
- Trigger a booking reminder, budget warning, and low-wallet alert and verify preference switches are respected.
- Verify the Today badge and inbox read/unread state update in real time.

## 7. Final production sign-off

- Set the deployed Site URL and every allowed authentication redirect URL in Supabase.
- Configure VAPID public/private keys, subject, service-role secret, and public browser key.
- Deploy `evaluate-notifications` and schedule it approximately every five minutes.
- Confirm no service-role or VAPID private key appears in browser assets or logs.
- Review Supabase authentication, function, database, and storage logs after testing.
- Remove the validation trip, test invitations, push subscriptions, and test files.
