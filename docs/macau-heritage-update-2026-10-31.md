# Macau heritage morning — 31 October 2026

Applied from fresh live Supabase records, preserving the previously saved trip and the 25 December dinner note. The user selected a shorter morning to meet the operator’s 12:30 check-in requirement for a requested 13:00 bungy slot. St Paul’s now gets 20 minutes, browsing 10, Senado 10, lunch 30 and Lisboa exterior photos 10. Walking and taxi allowances are retained; no scheduled stop is removed. The 27 December day title remains **Macau • Heritage • Bungy • Cotai**. A brief day note records the requested bus-app workflow; route logistics and booking caveats remain in activity details and the Guide.

| Time | Revised activity |
| --- | --- |
| 09:15–09:50 | Fisherman’s Wharf — unchanged |
| 09:50–10:15 | Taxi to permitted St Paul’s access, including final walk |
| 10:15–10:35 | Ruins of St Paul’s |
| 10:35–10:45 | Historic streets / browsing towards St Dominic’s |
| 10:45–10:50 | St Dominic’s exterior only |
| 10:50–10:55 | Walk to Senado |
| 10:55–11:05 | Senado Square |
| 11:05–11:35 | Lunch nearby |
| 11:35–11:50 | Walk to Grand Lisboa / original Lisboa |
| 11:50–12:00 | Exterior photos |
| 12:00–12:25 | Taxi to Tower, including pickup/wait and counter access |
| 12:25–16:00 | Tower planning allowance; activities unbooked, finish unguaranteed |

Existing activity IDs are reused. The old Wharf → Senado leg becomes Wharf → St Paul’s; the former northbound walk becomes the southbound historic-street walk. One new five-minute St Dominic’s → Senado transfer is needed to represent the revised route accurately. There are no duplicate transfers. All five affected transfer cards contain numeric duration/cost estimates and an exact matching recommendation. Walks show MOP0; taxi estimates are per car for two travellers, not expenses.

## Route checks and apps

[DSAT’s current taxi-stand list](https://www.dsat.gov.mo/dsat/taxi_station_info.aspx) includes Rua de D. Belchior Carneiro / 高園街 near Macao Museum, Fisherman’s Wharf convention centre, Grand Lisboa, original Lisboa and Macau Tower. The St Paul’s façade is reached on foot; the driver must use the nearest permitted drop-off under actual signage/temporary controls. Allow 3–8 minutes for the final walk within the 25-minute transfer. Taxi allowance: MOP50–80/car estimated.

Google Maps routes were opened and checked on 31 October:

- [Wharf → Rua de D. Belchior Carneiro](https://www.google.com/maps/dir/?api=1&origin=Macau+Fisherman%27s+Wharf&destination=Rua+de+D.+Belchior+Carneiro+Macao&travelmode=driving): about 3.7 km / 12 min driving; the itinerary adds pickup and pedestrian access.
- [Access street → St Paul’s](https://www.google.com/maps/dir/?api=1&origin=Rua+de+D.+Belchior+Carneiro+Macao&destination=Ruins+of+St.+Paul%27s+Macao&travelmode=walking): about 150 m / 2 min from the street pin; 3–8 min planning allowance accommodates the actual legal drop-off and crowds.
- [St Paul’s → St Dominic’s](https://www.google.com/maps/dir/?api=1&origin=Ruins+of+St.+Paul%27s+Macao&destination=St.+Dominic%27s+Church+Macao&travelmode=walking): about 450 m / 5–6 min via Rua de São Paulo, Rua da Palha and Rua de São Domingos. The revised 10-minute block includes brief browsing.
- [St Dominic’s → Senado](https://www.google.com/maps/dir/?api=1&origin=St.+Dominic%27s+Church+Macao&destination=Senado+Square+Macao&travelmode=walking): about 150 m / 2 min; five minutes allowed.
- [Senado → Grand Lisboa → original Hotel Lisboa](https://www.google.com/maps/dir/?api=1&origin=Senado+Square+Macao&destination=Hotel+Lisboa+Macao&waypoints=Grand+Lisboa+Macao&travelmode=walking): about 950 m / 14 min via Avenida de Almeida Ribeiro and Avenida do Infante Dom Henrique, with crossings. The short link between the two photo stops is included.
- [Hotel Lisboa → Tower](https://www.google.com/maps/dir/?api=1&origin=Hotel+Lisboa+Macao&destination=Macau+Tower&travelmode=driving): about 2–2.4 km / 7 min driving; the itinerary retains 25 minutes including pickup/wait/access. Taxi MOP35–60/car estimated.

These are planning estimates, not December traffic guarantees. The lunch restaurant remains flexible, so its exact access walk is still variable.

Bus guidance is added to the existing Macau transport Guide and a short 27 December day note: use Google Maps for candidate routes, bus numbers and stops; verify stop code/direction/diversions and watch live vehicles in DSAT’s **Bus Travelling System** (巴士報站; some stores use “Traveling”). **Macao Smart Go** is a useful second DSAT app with live bus information, routes and taxi/walking guidance. Neither guarantees an accurate ETA. Sources: [DSAT](https://www.dsat.gov.mo/dsat/index.aspx?lang=en), [DSAT Smart Go description](https://www.dsat.gov.mo/dsat/bus_news_detail.aspx?a_id=C75A52BBCAD0757744B6CD10FE3CC80A), [official Smart Go listing](https://play.google.com/store/apps/details?id=mo.gov.dsat.dis.travel), [University of Macau’s DSAT app guidance](https://sfs.cmdo.um.edu.mo/our-services/transport-services/public-transport/).

## Tower check-in and booking

The existing Tower placeholder and checklist now describe **bungy for one, requested 13:00**, plus **Skywalk for both**. They remain unbooked/unpaid; no actual ticket, payment or confirmation was created. Counter arrival targets 12:25, five minutes before the 12:30 deadline. The estimated 16:00 finish and every later hotel/evening time are retained. Earlier arrival provides buffer and does not imply an earlier activity or finish.

[Skypark’s bungy instructions](https://www.skyparkmacau.com/activities/bungy) and [Skywalk instructions](https://www.skyparkmacau.com/activities/skywalk) require arrival 30 minutes before the activity. Therefore an actual 13:00 slot needs **12:30 counter check-in**. The user chose to shorten the morning, so the revised 12:00 taxi departure targets the counter at 12:25, with five minutes of margin before 12:30. The transfer/Tower details, placeholder, checklist and Guide all agree. Choose quick-service lunch and cut browsing/photos first if delayed; traffic and queues remain variable. Actual slot availability, activity order and compatible Skywalk timing still need confirmation before purchase.

## Verification

- Lint, TypeScript, all 69 existing tests and the Vercel build passed for the heritage revision; the time adjustment is a guarded content-only follow-up.
- Scoped preflight and a fresh post-save live readback passed; every reviewed business field matches, and reapplication returns zero changes.
- Every unrelated record is unchanged, including Fisherman’s Wharf, all evening/hotel transfers, 28 December, the 25 December dinner note, 15 confirmed bookings, 10 attachments, budgets, accounts and six financial records.
- Morning rows are chronological, with unique sequences and no overlaps. The rendered transport schema has costs/durations and one matching recommendation per card.
- Live desktop and 393 × 738 phone checks passed: all five affected transport boxes, shortened morning rows, Tower arrival/unchanged 16:00 onward plan, concise bus day note, and expanded Guide bus instructions. Costs, recommendation badges and directions wrap within the phone viewport. Brave was restored to the unfiltered desktop Plan.
