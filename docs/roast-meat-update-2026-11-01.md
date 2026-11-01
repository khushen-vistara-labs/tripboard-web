# Roast-meat update — 1 November 2026

Applied the attached food brief to the current live trip, read on 1 November. Confirmed Macau accommodation and newer booking, attachment and payment changes were preserved.

## Itinerary and food checklist

- **29 December:** reused dinner row `cb34c752-eea4-49b7-9810-771990e304c9`, retaining 19:00–20:30. Its concise title is now “Chung Wah roast goose dinner,” with goose marked MUST. Ordering advice, price caveats, evening-stock checks, nearby Ki’son fallback and hotel-return directions are inside Trip details. Dinner allowance is **HK$160–200 total for two, estimated**.
- **1 January:** reused food-crawl row `02ac4ac7-ca6b-47e7-a035-d7c6135b8ccc`, retaining 19:00–21:00 and its title. Ki’son at 34 Mong Kok Road is a suggested stop for remaining meats; it becomes optional if all three were tasted on 29 December. The 546 Nathan Road branch is an alternative, not a second required visit. **HK$70–90 total, estimated**, covers one shared pork-combination rice plate within the crawl, not two dinners.
- Retained the existing **21:00–21:25** return-to-hotel row and packing schedule.
- **25 December:** the existing short post-Aqua Luna optional roast-meat note already met the brief and was preserved without edits. No restaurant or compulsory visit was added that day or on 26 December.
- Reused “Try roast goose” (`fdfbf883-cd20-415c-b244-7243cb9f4483`), marking it MUST and primarily associating it with 29 December. Added independent, incomplete “Try half-fat, half-lean char siu” and “Try crispy roast pork belly” items, with flexible 29 December / 1 January notes and restaurant links.
- Added three restaurant places, one Food guide reference and a pre-trip recheck task due 15 December. The guide explains **半肥瘦叉燒** and **燒肉 / 燒腩仔**, small shared portions, alternatives and soup checks.
- Retained **no beef / no beef broth**, including optional or complimentary soup. Added no Joy Hing visit, restaurant contact, reservation, purchase or financial transaction.

## Transport boxes and route evidence

The changed dinner, crawl and hotel-return rows use real `details.transportOptions`. Each `details.recommended` exactly matches one option name. Walking choices display **HK$0**. The 29 December Lantau return transport remains unchanged.

| Route checked in Google Maps | Mapped route | Planning allowance shown |
| --- | --- | --- |
| Bridal Tea House, 6 Arthur Street → Chung Wah, 497A Nathan Road | 170 m, 2 minutes, via Arthur Street / Man Ming Lane | 3–5 minutes, HK$0 |
| Yau Ma Tei station → Chung Wah | About 1 minute; OpenRice also identifies Exit C | 3–5 minutes from Exit C, HK$0 |
| Chung Wah → Ki’son, 546 Nathan Road | 230 m, 4 minutes, via Nathan Road | 5–8 minutes with crossings, HK$0 |
| Bridal Tea House → Ki’son, 34 Mong Kok Road | 1.3 km, 19 minutes, via Nathan Road | 20–25 minutes; depart after the 18:45 hotel rest, HK$0 |
| Northern Mong Kok / Ki’son → hotel | Reverse local walk; shorter if the crawl finishes farther south | 20–25 minutes within the retained return block, HK$0 |

Walks are estimates, including allowance for crossings and finding entrances. No extra timed dinner or local taxi/MTR journey was introduced.

## Prices, hours and unresolved checks

[Chung Wah’s OpenRice listing](https://www.openrice.com/zh/hongkong/r-中華燒鵝傳承-油麻地-港式-燒臘-r994488) lists 497A Nathan Road, Yau Ma Tei Exit C and regular daily 10:00–22:00 hours. This does not confirm evening goose stock, fresh-batch timing or holiday service. The [Corner guide](https://www.corner.inc/place/pbToexSa5ALY) reports an approximately HK$80 solo set, but its current price and contents are not verified and were not represented as a quotation.

[Ki’son Mong Kok’s listing](https://www.openrice.com/en/hongkong/r-kison-roasted-goose-mong-kok-hong-kong-style-chinese-bbq-r732289) identifies 34 Mong Kok Road, Exit B3 and regular daily 10:00–22:00 hours. The [Yau Ma Tei listing](https://www.openrice.com/zh-cn/hongkong/r-棋子燒鵝-油麻地-港式-燒臘-r1147645) identifies 546 Nathan Road, Shops B–C, near Exit A2; its opening and stock need checking separately.

The [Foodpanda Mong Kok menu](https://www.foodpanda.hk/restaurant/szjv/kison-roasted-goose-mongkok), checked 1 November, shows online base prices before promotions: goose rice from HK$70, two-meat rice from HK$70, and goose plus one other meat rice from HK$75. Supplements can apply. These are not verified dine-in prices or prices for the Yau Ma Tei branch.

The pre-trip task covers current Chung Wah prices, 19:00 goose stock / fresh-batch timing, whether reservation or preorder is useful, Ki’son’s New Year’s Day service and meat availability, and sharing / minimum-order terms. Dinner and tasting allowances replace or form part of existing spending. Numeric activity-cost fields and all budgets remain unchanged, so no duplicate estimated meal charge was introduced.

## Verification

- Lint, TypeScript, all **76 unit tests**, and the Vercel build passed.
- The scoped updater checks reviewed old field values and current versions, saves private backups, protects confirmed bookings and finances, and reports a second application as a no-op.
- A save-order error was caught by a foreign-key constraint before the crawl could link to its new checklist item. The manifest was reordered so restaurant places and checklist items exist first; all remaining changes then saved successfully. Every foreign-key reference was checked against the revised order.
- The complete live before/after audit verified every original row and field outside the reviewed patches. **20 bookings, 11 attachment records, 8 financial transactions, 10 day titles, 138 activity IDs, all activity times/sequences and all numeric cost fields were preserved.** Final counts: 59 places, 62 checklist items and 44 notes.
- The real app rendered the saved live snapshot on desktop Chrome, Android Chrome and iPhone WebKit through an isolated read-only mock backend at `tripboard-qa.invalid`. Checks covered visible transport cards/recommendations/costs, expanded details, retained day headings, the 25 December note, independent food items, selected place/checklist links and the Food guide. No production write was possible from those browser checks.
- An additional signed-in production-tab check was interrupted by concurrent Brave browsing. No browser writes were made. The completed desktop/Android/iPhone rendering checks used the actual saved live snapshot through the real application and its normal data loader; this limitation concerns the extra signed-in-tab check, not the rendered transport/details/checklist/Guide checks above.

Screenshots and machine-readable rendering results are kept in the ignored local `outputs/roast-meats-2026-11-01/` directory. Private trip snapshots, credentials, booking references and financial records are not included in this report or the change manifest.
