# TripBoard architecture

## Product boundary

TripBoard is a private, responsive PWA. It is intentionally not a native wrapper. Routes are regular browser routes and the core trip, time, checklist, and finance rules live under `src/`, independent of the web presentation layer. A later native client can reuse the types, rules, RPC contracts, and database without importing browser-only code.

## Application layers

- `app/` contains the Vite/Vinext route entries and global metadata. Vinext is used because the Sites runtime requires Cloudflare Worker-compatible Vite output; product logic does not depend on it.
- `src/components/` contains the app shell and accessible reusable interaction components.
- `src/features/` owns feature-specific views and domain rules.
- `src/lib/supabase/` is the only browser entry point to Supabase.
- `src/lib/offline/` owns the Dexie cache and replay queue.
- `src/types/` contains reusable domain types.
- `supabase/migrations/` is the reproducible database source of truth.
- `seed/` and `scripts/seed-trip.ts` provide validated, non-component trip import data.

Server state is designed for TanStack Query and Supabase Realtime. Local interaction state stays in React. The current data hook keeps the small MVP surface coherent while exposing stable service boundaries; it can be split into query-specific hooks without moving domain rules into components.

## Authentication and membership

Supabase Auth uses email OTP. The PWA calls `signInWithOtp`, accepts the six-digit code in the same installed context, and lets Supabase persist and refresh the session. A database trigger creates or updates `profiles`.

An owner creates a trip and is inserted into `trip_members` automatically. Invitations store only a SHA-256 token hash, expire, and can be accepted once by the authenticated email they target. `accept_trip_invite` creates one membership row; it never copies trip data.

Trip identities are security and synchronization identities. Itinerary, completion, checklists, and finances remain trip-level.

## Database and authorization

Every user-owned or trip-scoped table has RLS enabled. Reusable `is_trip_member` and `is_trip_owner` security-definer helpers centralize membership checks and avoid recursive membership policies. Normal collaborative data can be written by members; owner-only trip deletion and membership administration remain restricted.

Financial tables have read policies but no direct client insert/update policy. All money writes go through transaction-scoped RPC functions that validate membership, account association, currencies, sufficient balance, and an idempotency UUID. Stored-value account rows are locked before balance validation, preventing concurrent overspend.

Booking documents use the private `booking-documents` Supabase Storage bucket. Paths start with the trip UUID so storage policies can apply the same membership check. MIME types and file size are restricted in both bucket configuration and `booking_files`.

## Realtime model

The client opens one channel per active trip and subscribes at trip scope to itinerary, checklist, bookings, finance, and notification changes. A change refreshes the relevant shared data. Channels are removed when the component unmounts or the trip changes.

Supabase Realtime is not trusted for authorization; RLS controls which Postgres changes a connection may receive. The service-role key is never included in browser code.

## Offline model

The service worker caches the application shell and previously opened routes. IndexedDB, through Dexie, stores cached trip records and mutation commands. A queued mutation has one stable client-generated UUID that also becomes the financial idempotency key.

When a user changes data offline:

1. React updates optimistically.
2. The command is stored in Dexie as `PENDING`.
3. Replay runs on `online` and window focus; Background Sync is not required.
4. Successful commands are removed.
5. A balance or version rejection becomes `CONFLICT`; other errors become `FAILED` and remain retryable.

Stored-value purchases use the last cached balance to reject obvious local overspend. The database rechecks under a row lock during replay, so two offline devices can never force a wallet below zero. A rejected purchase stays visible for reconciliation.

## Time model

Trips carry an IANA timezone. Timestamp values are stored in UTC; date-only itinerary days remain Postgres `date`. Overdue rules parse schedules in the trip timezone, not the device timezone. `MISSED` is derived: a planned item becomes overdue after its end or expected duration plus the configured grace period, then unresolved after the trip day ends.

## PWA and notifications

The manifest has a stable root ID, standalone display mode, theme colors, PNG icon set, and normal route shortcuts. The service worker supports offline navigation and visible push notifications. Permission is requested only from the explicit “Enable trip alerts” action and capability checks are feature-based.

The notification Edge Function is intended to run roughly every five minutes. It inserts deduplicated in-app notifications, rechecks current item state immediately before delivery, and sends visible Web Push only when VAPID and a device subscription are configured.

## Deployment

The app emits Cloudflare Worker-compatible ESM through Vite and contains no provider-specific product logic. Supabase remains the backend. It can be hosted through Sites or adapted to Vercel without moving domain or database code.
