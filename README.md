# TripBoard

TripBoard is a private, shared, mobile-first trip manager PWA for a small travelling group. It keeps the live itinerary, must-do checklist, food goals, bookings, local wallet balances, budgets, and actual consumption in one shared operational view.

The initial seed represents a Hong Kong and Macau trip from 25 December 2026 through 2 January 2027. Trip content is imported data, not hard-coded into route components.

## Architecture

- React 19 + TypeScript strict mode
- Vite with Vinext route entries and Nitro's Vercel build output
- Tailwind CSS plus product-specific responsive styles
- TanStack Query boundary for server state
- Supabase Postgres, Auth, Realtime, Storage, Edge Functions, and RLS
- Dexie/IndexedDB for cached trip records and the offline mutation queue
- Decimal.js for frontend money previews; Postgres `numeric` for authority
- Luxon for trip-timezone calculations
- Zod for seed and unsafe input validation
- Vitest for domain rules and Playwright for critical browser journeys

See [architecture](docs/architecture.md) and the [financial model](docs/financial-model.md) for the detailed design.

## Prerequisites

- Node.js 22.13 or newer
- pnpm 11
- A Supabase project
- Supabase CLI for local database migrations and database tests

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the browser-safe Supabase URL and anonymous key.

3. Start the application:

   ```bash
   pnpm dev
   ```

Without Supabase variables the app intentionally opens with clearly labelled preview data. It does not pretend that preview changes are shared remotely.

## Supabase setup

Create a Supabase project, then link the local repository:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates enums, tables, indexes, RLS policies, private booking storage, audit triggers, Realtime publication entries, financial views, and transactional RPC functions. Do not recreate them manually in the Dashboard.

TripBoard uses email and password sign-in so the two travellers can use their own accounts without relying on paid email delivery. In Supabase Authentication, keep the Email provider enabled and turn off **Confirm email**; otherwise new accounts will be sent a confirmation link.

### Environment variables

Browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (safe public Web Push key)

Seed script only:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TRIPBOARD_SEED_OWNER_EMAIL`

Notification Edge Function only:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Never expose `SUPABASE_SERVICE_ROLE_KEY` or the VAPID private key to browser code.

## Seed the Hong Kong trip

Sign in once with the owner email so an Auth user exists, configure the seed-only environment variables, then run:

```bash
pnpm seed:trip
```

The script validates `seed/hong-kong-2026.json` with Zod and imports the trip, days, places, checklist, bookings, itinerary, payment accounts, and budgets.

After changing the JSON itinerary for an already seeded trip, run the explicit itinerary sync:

```bash
pnpm sync:itinerary
```

This replaces that trip's itinerary entries with the JSON version, including removing entries no longer in the file. It preserves the trip's checklist, places, bookings, accounts, budgets, and financial records.

For the Hong Kong seed's itinerary plus newly added preparation checklist content, run:

```bash
pnpm sync:trip-content
```

This still preserves financial records, bookings, places, and existing checklist progress; it only adds new checklist entries that are not already present.

### Trip Guide / Quick Reference

`/guide` is a direct, travel-time reference screen rather than a notes dump. It is built from the existing `trip_notes` records, which support a category, short summary, icon, optional Chinese copy text, easy pronunciation, and English meaning.

The Hong Kong seed includes quick-reference cards for language phrases, payments and ATM/DCC, Octopus, getting around, connectivity, Macau essentials, hotel details, and emergency help. Traveller actions such as Copy, Play, Show large, and Open map are prominent; edit and delete stay under the overflow menu. Longer supporting text is collapsed by default.

Use the narrowly scoped Guide sync after changing its seed records:

```bash
pnpm sync:trip-guide
```

It updates only the current shared trip's Guide records and Bridal Tea House hotel address/map reference. It also removes the retired legacy Guide records that the current cards replace; it does not alter itinerary order, bookings, financial data, or checklist completion.

Today may derive one short contextual reminder from the same Guide data. For example, a Macau itinerary day shows the Macau essentials reminder with a link back to the Guide instead of duplicating the whole section.

## Macau overnight update (28 October 2026)

The live 26–28 December revision uses `data/updates/macau-2026-10-28.json` and a scoped Supabase updater. It preserves existing record IDs, reuses matching places, protects confirmed bookings and history, and never writes attachments, accounts, budgets or financial transactions. The reviewed baselines include newer live changes after the 27 October export; private snapshots and credentials are not committed.

```bash
pnpm update:macau                              # read-only plan against live state
pnpm update:macau --apply --backup=/tmp/tripboard-before-macau.json
```

Use a fresh private backup path for an apply. Each edited field must still match its reviewed old value or already match the desired value. Any newer conflict stops preflight before writes; concurrent changes are protected by database version/timestamp comparisons (and edited-field comparisons for Guide notes). Server triggers manage versions. New IDs are stable; repeating a completed update is a no-op. An interrupted apply can be rerun after reviewing a fresh dry run. Deletions are limited to reviewed, uncompleted obsolete transfers and happen last.

This update is independent of the older developer seed. Do not run the full seed/itinerary/Guide sync to apply it: those commands use older planning content and can replace live edits. Treasure and both ferries remain unbooked placeholders; the INR4,300 hotel amount is an estimate, never an expense.

### Restore the revised route's transport boxes

The follow-up correction restores `details.transportOptions` and matching recommendations for 22 travel legs on 26–28 December. It retains the revised routes, all supporting notes, booking warnings and the existing transport-box styling.

```bash
pnpm update:macau:transport                    # read-only plan
pnpm update:macau:transport --apply --backup=/tmp/tripboard-before-transport-boxes.json
```

The original overnight manifest is historical; this correction supersedes its transport-details fields. Use the correction command to recheck/reapply it. Repeating it is a no-op, and an older manifest cannot silently overwrite the restored choices because reviewed-value checks reject that conflict.

## Search the current section

Use the search icon above the current screen to expand a compact search field inline; its scope hint appears as placeholder text. It searches full descriptions, notes, addresses, nearby food, transport choices, and linked booking/place details within the selected menu item. Plan and Trip at a Glance search every day; Today uses the current date in the trip timezone. Money searches transactions, merchants, accounts, and budgets. Guide and Immigration search their own complete reference text.

Results show the matching text and offer **All details**. Plan results can open the correct day and activity. Clearing or closing section search restores the existing screen and its local filters, including Plan's separate day search. Search works on the trip data already loaded on the device, including its offline copy.

## Export the current trip

Use **More → Trip settings → Export trip JSON** to download the current trip for review in another planning chat. The timestamped JSON includes trip settings, day titles and notes, the itinerary and its details, all Guide/Important Notes, checklist progress and notes, places, bookings, budgets, payment accounts, and financial transactions. Booking attachments are represented by their metadata; the actual private files are not embedded.

The export is a snapshot of the data currently loaded in the app, including edits made through the site. Go online, let pending changes sync, and refresh before exporting to share the latest saved trip. The seed JSON in the repository is not updated by site edits, and this export is not a seed-import file.

## Commands

```bash
pnpm dev          # local PWA
pnpm lint         # source lint
pnpm typecheck    # strict TypeScript
pnpm test         # unit tests, including all financial acceptance cases
pnpm build        # Vercel production build
pnpm start        # local preview of the Vercel build
pnpm check        # lint + typecheck + tests + build
pnpm seed:trip    # validated developer trip import
pnpm sync:itinerary # replace an existing seed trip's itinerary from JSON
pnpm sync:trip-guide # reconcile only the shared trip's Guide references
```

Run critical browser journeys with:

```bash
pnpm exec playwright test
```

Database tests require a running local Supabase stack:

```bash
supabase start
supabase test db
```

## PWA installation

Android/Chromium browsers show the install action when the browser raises the install prompt. On iPhone or iPad, open TripBoard in Safari, use Share, then choose **Add to Home Screen**. Installation is optional; every screen remains a normal URL.

The service worker caches the app shell, including `/guide`, and previously opened routes. A deployment changes the shell-cache version, immediately activates the new worker, removes obsolete shell caches, and claims open clients. IndexedDB queues mutations and retries them on reconnect and focus; the trip snapshot is refreshed from Supabase on initial load, focus, and reconnect. Browser Background Sync is treated only as an optional enhancement.

## Push configuration

Deploy `supabase/functions/evaluate-notifications` with the server-only secrets above. Schedule it approximately every five minutes using Supabase Cron. The evaluator inserts deduplicated in-app notifications, rechecks current trip state, and sends visible Web Push only to configured device subscriptions.

Morning and evening summaries run only within the trip dates when that day has pending activities (planned or moved). The evaluator rechecks that count before sending, so empty days and completed plans do not produce review alerts. Today’s greeting follows the trip timezone and updates while the screen stays open.

Notification permission is never requested during initial page load. Each device must use **More → Trip alerts → Enable trip alerts**.

## Deployment

TripBoard is deployed only to **Vercel**, with Supabase providing the backend. The connected GitHub repository deploys `main` to production and feature branches to Vercel previews. ChatGPT Sites is not used for deployment; the existing Sites/Cloudflare development configuration and `.openai/hosting.json` are legacy scaffolding.

Configure the public Supabase environment variables in Vercel and use `pnpm build` (`pnpm build:vercel` is an equivalent explicit command). Nitro emits Vercel's Build Output API files in `.vercel/output` and mirrors them to `.output` for CI inspection. Keep the Vercel output-directory override disabled so it recognizes the native Build Output API files. Keep the service worker at the origin root.

## Browser and PWA limitations

- Offline mode cannot provide offline turn-by-turn maps; addresses and transport notes remain available.
- Booking files are cached only after the browser has opened them and cache/storage policy permits it.
- Web Push requires standards support and, on supported iPhone/iPad versions, installation to the Home Screen.
- Background Sync is inconsistent across browsers; reconnect and focus retries are the reliable path.
- A final card settlement may remain provisional until the user enters the actual INR charge.

## Security notes

- Every trip-scoped user table has RLS.
- Financial inserts are RPC-only and idempotent.
- Booking documents live in a private bucket with trip-member policies.
- Uploaded filenames, MIME types, and sizes are restricted.
- Full card numbers, CVV, PINs, auth tokens, OTP codes, and banking credentials must never be stored or logged.
