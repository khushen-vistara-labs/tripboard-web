# Macau overnight update — 28 October 2026

Applied to the existing Supabase trip using the 28 October brief and the 27 October export as context. Live state was read first: it already included newer Luk On Kui / Man Mo moves and removal of Tai Kwun, PMQ and the generic Central lunch. Those changes were retained. No confirmed-booking conflict was present.

## Saved changes

- **26 December:** preserved the early Peak, descent, Happy Valley and evening route. Cheung Hing is a light bun/tea stop. Western Market tram 11:25–12:10, walk 12:10–12:25, Luk On Kui lunch 12:25–13:40, uphill walk 13:40–14:00, Man Mo 14:00–14:35, Hollywood Road east 14:35–15:15, Central/rest 15:15–17:10. Existing Luk On Kui / Man Mo IDs retained; no Monday duplicates. Tai Kwun/PMQ remain excluded. Lee Tung Avenue's festive programme remains unconfirmed.
- **27 December:** 06:45 MTR/taxi transfer and 07:35 terminal buffer; outbound 08:30 TurboJET to Outer Harbour; historic centre/lunch; 13:30 bungy check-in for a 14:00 target, with processing/photos until an estimated 16:00. Taxi to proposed Treasure check-in/rest/snack 16:30–17:00. Airport → Wynn, Venetian, Parisian exterior, separate indoor Londoner guard and outdoor facade show, dinner, then 21:45–22:15 taxi to Treasure. Full transport instructions, estimates, queue cutoffs and meal fallbacks saved. Monte Fort, Fisherman's Wharf and Golden Reel are separate untimed optional alternatives. Pandas skipped by default; the mutually exclusive earlier-Sunday alternative is in the Guide.
- **28 December:** breakfast/checkout and Airport LRT to Taipa terminal; 08:10 check-in, 09:00 ferry to Sheung Wan, immigration buffer, direct MTR to Kowloon. Wong Tai Sin, Nan Lian, proper Diamond Hill lunch, conditional Choi Hung/Ping Shek, optional Sham Shui Po and shorter Mong Kok. Omit estates first, then Sham Shui Po if delayed. Temple Street, Hing Kee, Kai Kai and their transfers retain their existing content/times; only sequence positions changed.
- **Place/bookings:** one Treasure place and one HOTEL placeholder added, linked to check-in. INR4,300 is explicitly an unverified room-for-two estimate. Existing ferry placeholders reused: 27 Dec 08:30 outbound and 28 Dec 09:00 return. Bungy remains a placeholder and its false `prebooked` detail is removed. All times use Hong Kong/Macau UTC+8; the trip timezone is unchanged.
- **Guide/checklist:** added hotel booking/conditions and holiday dim sum rechecks; updated ferry/bungy tasks, partner viewing access, documents, cash, overnight bag, retained Hong Kong room, two-calendar-day roaming and transport/show rechecks. Guide includes shuttle directions/hours, Parisian deck closure, separate Londoner shows, pandas alternative and supplied operator links. Immigration's Macau answer/facts were edited without replacing other traveller facts. Existing Macau payment guidance is untouched. No automation, purchase, cancellation or payment action occurred.

Database operations: 76 record updates, 18 inserts and two obsolete uncompleted transfer removals. Inserts comprise ten itinerary rows, four Guide notes, two checklist tasks, one place and one hotel placeholder. The old 23:00 return-ferry row was moved to Monday morning with its existing ID; the redundant Fisherman's Wharf walk and midnight Hong Kong hotel transfer were removed.

## Preservation and verification

- All confirmed bookings, traveller/reference fields and ten attachment metadata records retained unchanged; no storage operations.
- Both budgets, nine accounts and six financial events retained unchanged. No expense or payment created.
- Trip settings, all itinerary dates outside 26–28 December, including 29 December Lantau and 30 December Disneyland, retained unchanged.
- Fresh live read matches the reviewed proposal. Chronological sequence and no overlapping timed rows verified on all three dates; all IDs, foreign keys, itinerary-day dates and booking links checked.
- Live reapplication produces **zero changes**. Edited columns use reviewed old-value hashes; database version/timestamp comparisons protect concurrent changes. Notes also compare edited old text because they have no version bump trigger. Versions are not fabricated or copied from the export.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (60 tests), `pnpm build` and `git diff --check` passed.

Private before/after snapshots were saved outside the repository. The committed manifest contains only targeted content and hashes; private traveller Q&A is transformed in place, not copied into source control.

## Still to book or reconfirm

Treasure, both ferries and bungy are unbooked. Verify Treasure's taxes, room type, cancellation and breakfast; actual ferry inventory/fares/cutoffs; Meghana's spectator ticket and deck access. Recheck shuttle bays, December/festive show changes, Parisian deck closure/illumination, estate access/works and roaming activation/expiry 1–2 weeks before travel. Times and taxi fares remain planning estimates; no guaranteed bungy completion or show access.

## Follow-up: restore transport boxes

The initial revision replaced structured `details.transportOptions` with prose. That removed the existing visible option boxes from the revised travel legs. The correction `macau-transport-2026-10-28.json` restores choices and an exact matching recommendation on 22 legs: four on Saturday, eleven on Sunday and seven on Monday. Existing supporting details and notes are retained. Times and known cost estimates are shown in the boxes; unverified fares require an actual quote rather than the retired low cross-harbour taxi estimate. No layout redesign was needed.

Applied and verified against live Supabase state. Only itinerary `details` fields changed; schedules, operational text, bookings, attachments, finances and unrelated rows were retained. Live Plan verification showed the expected boxes/recommendation badges on all three dates, matching the existing Saturday 10:25 transfer. Lint, typecheck, all 63 tests, production build and diff checks passed. Reapplication is a no-op.

## Follow-up: restore compact day headers

Cleared the added `itinerary_days.notes` paragraphs on 26, 27 and 28 December, restoring the previous compact date/title headers. Day titles, itinerary rows, restored transport boxes, Guide notes, checklist and booking records are retained. The original manifest no longer adds these header paragraphs. The cleanup command is `pnpm update:macau --manifest=macau-headers-2026-10-28.json`; use `--apply` with a fresh private `--backup` path to save it. Reviewed-value and version checks protect newer edits; reapplication is a no-op.
