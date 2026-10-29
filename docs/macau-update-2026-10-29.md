# Macau revision — 29 October 2026

Applied to the existing Supabase trip using the revised October 29 brief. Current live records were read before writing and matched the latest supplied October 28 export. No wholesale import or developer seed sync was used. Private snapshots remain outside the repository.

## Before and after

| Area | Previous plan | Revised plan |
| --- | --- | --- |
| Day summaries | Long resort/transport themes | 27 Dec: **Macau • Heritage • Bungy • Cotai**. 28 Dec: **Macau Return • Temples • Kowloon Markets**. No day-summary paragraphs. |
| Sunday morning | 08:30 ferry; Wharf untimed | 05:55 taxi, 06:40 terminal buffer, 07:30 TurboJET, timed Wharf 09:15–09:50, heritage route, Grand Lisboa/original Lisboa exteriors before Tower. |
| Bungy | 14:00 placeholder | Retained: 13:30 check-in, 14:00 target, variable finish; partner viewing requires confirmation. |
| Overnight hotel | Treasure proposal, INR4,300 estimate | Same placeholder booking ID now proposes **Asia Boutique Inn**, 146 Rua Correia da Silva, Taipa. INR6,500 for one room/two is an unverified quote. Treasure's separate place remains an unused reference. |
| Evening | Early Wynn/airport-base route | Asia → Galaxy's two lobbies → Venetian/dinner → Parisian → Londoner → MGM Cotai → late Wynn fountains → Asia. Separate transfer rows; no scheduled SkyCab queue. |
| Monday | Airport-hotel instructions | 06:45 breakfast/checkout; 07:15 walk/Pai Kok LRT towards Taipa Ferry, 08:10 terminal target; taxi fallback around 07:40. 09:00 return ferry retained. |
| Transport display | Old route/cost content | **17 revised travel cards**, each using the existing `details.transportOptions` component with routes, durations, scoped numeric fares and one exact matching recommendation. |

Published standard ferry fares are HKD212/person (HKD424/two) outbound and MOP192/person (MOP384/two) return. Taxi ranges retain their original HKD/MOP currencies and per-car scope; LRT shows per-person/two totals, and walks explicitly show MOP0 (Free). Estimates were saved as planning allowances, never payments. The Money screen derives actual spending from financial records, not these allowances.

Guide, relevant immigration hotel wording, existing checklist tasks, hotel facts, place links and booking placeholders agree with the revised route. Both-calendar-day roaming remains explicit. The Guide's home-address card prefers the confirmed Hong Kong hotel. Untimed optional substitutions are excluded from the overview's main route. A phone rendering check exposed long source URLs widening the Guide; text wrapping was fixed without changing its layout, typography or transport component.

## Validation

- [x] Lint, TypeScript, all **69 tests**, and `pnpm build` passed. Only existing Vinext dynamic-import bundling warnings remained.
- [x] Fresh live readback matched every reviewed business field. Reapplication produces **zero changes**.
- [x] 26/27/28 December rows are chronological, with unique sequences and no overlaps. Ferry buffers remain separate; UTC+8 conversion, links and IDs checked.
- [x] 26 December and Monday's post-10:00 itinerary remain unchanged, including Luk On Kui/Man Mo on Saturday and the established Kowloon/food route on Monday.
- [x] All **15 confirmed bookings**, **10 attachments**, **9 accounts**, **2 budgets**, **6 financial records**, and existing checklist/itinerary progress remain unchanged. All dates outside this revision are retained.
- [x] Live 26–28 December rendered on desktop and a **393 × 738 phone viewport**, with comparison to untouched 29 December. All 17 revised transport boxes showed prices and recommendation badges; expanded details and supporting Guide/checklist/place/booking records were inspected.
- [x] The deployed Guide source note was expanded at phone width; long URLs wrap and the surrounding page stays within the viewport. Desktop Guide rendering checked too.
- [x] Production code release `042a211` pushed through the existing main-to-Vercel integration; Vercel reported success.

## Remaining travel confirmations

Hotel, ferries and bungy remain placeholders. No purchase, cancellation, message, financial event or automation was created. December ferry seats, hotel conditions, holiday shows/lighting, shuttle bays/hours and LRT departures require reconfirmation.

Galaxy Diamond and Crystal are separate lobbies within one hour-long visit; Fortune Diamond is not a third attraction. Late MGM is for interiors: the [current MGM operator page](https://www.mgm.mo/en/entertainment/happening/enchanted-garden-odyssey) promotes a daytime flying-ladybug garden show, while dolphin operation remains unconfirmed. The default route misses the 20:30 indoor guard; its 21:30 outdoor facade target is optional. Pandas, Monte Fort, Golden Reel and Grand Lisboa Palace remain substitutions/references. Casino access and complimentary refreshments are subject to local rules; neither shows nor freebies are guaranteed.

Current fare evidence: [TurboJET standard fares](https://www2.turbojet.com.hk/announcement/fare-adjustment-effective-from-april-25-2026/), [Cotai Water Jet schedule and fares](https://www.cotaiwaterjet.com/ferry-schedule/hongkong-macau-taipa). The live Guide retains the full source/recheck list, including explicitly unverified holiday details.
