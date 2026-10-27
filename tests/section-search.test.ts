import { describe, expect, it } from "vitest";
import { buildSearchDocuments, matchExcerpt, searchDocuments, type SearchData } from "../src/features/search/section-search";

const data: SearchData = {
  trip: { id: "trip", name: "Hong Kong", startDate: "2026-12-28", endDate: "2026-12-30", timezone: "Asia/Hong_Kong", baseCurrency: "INR" },
  demoMode: false,
  days: [
    { id: "day-28", tripId: "trip", date: "2026-12-28", title: "Lantau", notes: "Bring a windbreaker for the plateau." },
    { id: "day-29", tripId: "trip", date: "2026-12-29", title: "Central", notes: "Meet outside the east entrance." },
  ],
  itinerary: [
    { id: "cable", tripId: "trip", date: "2026-12-28", title: "Cable car", type: "attraction", priority: "MUST", status: "PLANNED", sequence: 0, placeId: "station", bookingId: "ticket", description: "Take the scenic route", notes: "Collect the blue wristband", transportInstructions: "Take bus 23", details: { foodNearby: ["Pineapple bun at Café Lotus"], transportOptions: [{ name: "Bus", route: "Via Tung Chung Crescent", notes: "Use exit B" }] } },
    { id: "walk", tripId: "trip", date: "2026-12-29", title: "Evening walk", type: "activity", priority: "WANT", status: "PLANNED", sequence: 0, description: "Try egg waffles beside the harbour" },
  ],
  places: [{ id: "station", tripId: "trip", name: "Lower terminal", address: "11 Tat Tung Road", notes: "Use the shaded entrance", priority: "MUST" }],
  bookings: [{ id: "ticket", tripId: "trip", title: "Advance ticket", type: "TICKET", provider: "Sky Tours", reference: "NP360-ABC", startsAt: "2026-12-27T17:30:00Z", notes: "Collect from counter seven", status: "CONFIRMED", files: [{ name: "Boarding voucher.pdf", kind: "PDF" }] }],
  checklist: [{ id: "snack", tripId: "trip", title: "Afternoon snack", kind: "FOOD", priority: "WANT", notes: "Try steamed milk pudding", description: "A small tea break", plannedDay: "2026-12-28", linkedPlaceId: "station", targetCount: 1, completedCount: 0, status: "PLANNED", sortOrder: 0 }],
  notes: [
    { id: "guide", tripId: "trip", section: "Food & language", title: "Ordering food", body: "Avoid shellfish broth", summary: "Mention the allergy", copyText: "不要蝦", pronunciation: "mm yiu haa", meaning: "No prawns", sortOrder: 0 },
    { id: "entry", tripId: "trip", section: "immigration", title: "Travel facts", body: "Accommodation near Yau Ma Tei", sortOrder: 0 },
    { id: "setup", tripId: "trip", section: "culture / immigration guide", title: "Immigration guide initialized", body: "Internal marker", sortOrder: 0 },
  ],
  accounts: [{ id: "card", name: "Travel card", accountClass: "EXTERNAL_SOURCE", currency: "INR", openingBalance: "0", issuingBank: "Example Bank", lastFour: "1234" }],
  budgets: [{ id: "food-budget", tripId: "trip", amount: "1200.50", currency: "HKD", scope: "CATEGORY", category: "Food" }],
  financialEvents: [{ id: "lunch", idempotencyKey: "lunch", type: "PURCHASE", occurredAt: "2026-12-27T17:00:00Z", description: "Lunch", merchant: "Market Canteen", category: "Food", sourceAccountId: "card", sourceAmount: "88", sourceCurrency: "HKD" }],
};

const search = (screen: Parameters<typeof buildSearchDocuments>[1], query: string) => searchDocuments(buildSearchDocuments(data, screen, "2026-12-28"), query);

describe("section search", () => {
  it("searches all plan days and the detail text hidden from overview cards", () => {
    for (const screen of ["plan", "overview"] as const) {
      expect(search(screen, "egg waffles").map((item) => item.id)).toContain("itinerary:walk");
      expect(search(screen, "windbreaker").map((item) => item.id)).toContain("day:day-28");
      expect(search(screen, "blue wristband").map((item) => item.id)).toContain("itinerary:cable");
      expect(search(screen, "Tung Chung Crescent")[0].matches.some((field) => field.value.includes("Crescent"))).toBe(true);
    }
  });

  it("finds linked street addresses, booking notes and file names inside the plan", () => {
    for (const query of ["Tat Tung Road", "shaded entrance", "counter seven", "Boarding voucher", "NP360-ABC"]) {
      expect(search("plan", query).map((item) => item.id)).toContain("itinerary:cable");
    }
    expect(search("plan", "cable")[0].href).toContain("date=2026-12-28&focus=cable");
  });

  it("keeps Today scoped to the trip's date, including UTC timestamps crossing midnight", () => {
    expect(search("today", "egg waffles")).toEqual([]);
    expect(search("today", "east entrance")).toEqual([]);
    expect(search("today", "Market Canteen").map((item) => item.id)).toContain("financial:lunch");
    expect(search("today", "Advance ticket").map((item) => item.id)).toContain("booking:ticket");
    expect(search("today", "milk pudding").map((item) => item.id)).toContain("checklist:snack");
  });

  it("matches words across titles and fields without leaking other sections", () => {
    expect(search("plan", "cable counter seven").map((item) => item.id)).toEqual(["itinerary:cable"]);
    expect(search("money", "Market travel card").map((item) => item.id)).toEqual(["financial:lunch"]);
    expect(search("money", "shellfish")).toEqual([]);
    expect(search("guide", "Market Canteen")).toEqual([]);
    expect(search("checklist", "milk pudding").map((item) => item.id)).toEqual(["checklist:snack"]);
    expect(search("checklist", "Tat Tung").map((item) => item.id)).toEqual(["checklist:snack"]);
  });

  it("searches every money subsection, not just transaction descriptions", () => {
    expect(search("money", "Example Bank").map((item) => item.id)).toEqual(["account:card"]);
    expect(search("money", "HKD 1200.50").map((item) => item.id)).toEqual(["budget:food-budget"]);
    expect(search("money", "Market Canteen").map((item) => item.id)).toEqual(["financial:lunch"]);
  });

  it("searches full Guide and Immigration notes while keeping them separate", () => {
    for (const query of ["shellfish", "allergy", "不要蝦", "mm yiu haa", "No prawns"]) {
      expect(search("guide", query).map((item) => item.id)).toEqual(["note:guide"]);
    }
    expect(search("guide", "Yau Ma Tei")).toEqual([]);
    expect(search("immigration", "Yau Ma Tei").map((item) => item.id)).toEqual(["note:entry"]);
    expect(search("immigration", "Internal marker")).toEqual([]);
  });

  it("searches More tools and document metadata, without indexing technical IDs", () => {
    expect(search("more", "export").map((item) => item.id)).toContain("tool:settings");
    expect(search("more", "Tat Tung").map((item) => item.id)).toContain("place:station");
    expect(search("bookings", "counter seven").map((item) => item.id)).toEqual(["booking:ticket"]);
    expect(search("bookings", "Boarding voucher").map((item) => item.id)).toEqual(["booking:ticket"]);
    expect(search("money", "idempotencyKey")).toEqual([]);
  });

  it("ignores case, accents, and repeated whitespace, and accepts punctuation literally", () => {
    expect(search("plan", "  PINEAPPLE   cafe  ").map((item) => item.id)).toEqual(["itinerary:cable"]);
    expect(search("guide", "[.*")).toEqual([]);
    expect(search("plan", "   ")).toEqual([]);
  });

  it("preserves original note and file-name punctuation in the displayed details", () => {
    const source = { ...data, bookings: data.bookings.map((booking) => ({ ...booking, notes: "Collect using code ABC_123", files: [{ name: "boarding_ticket_2026.pdf", kind: "PDF" }] })) };
    const results = searchDocuments(buildSearchDocuments(source, "bookings"), "boarding_ticket_2026.pdf");
    expect(results[0].fields.some((field) => field.value === "boarding_ticket_2026.pdf")).toBe(true);
    expect(results[0].fields.some((field) => field.value === "Collect using code ABC_123")).toBe(true);
  });

  it("ranks title matches first and surfaces a match deep in a long note", () => {
    const results = searchDocuments([
      { id: "details", title: "Bakery", kind: "Activity", fields: [{ label: "Notes", value: "Order a pineapple bun" }] },
      { id: "title", title: "Pineapple bun", kind: "Activity", fields: [] },
    ], "pineapple");
    expect(results.map((item) => item.id)).toEqual(["title", "details"]);
    const excerpt = matchExcerpt(`${"Before. ".repeat(100)}Hidden street name${" After.".repeat(100)}`, "Hidden street");
    expect(excerpt).toContain("Hidden street name");
    expect(excerpt.length).toBeLessThanOrEqual(242);
  });

  it("prioritizes the matching phrase and treats single-letter exits as whole words", () => {
    const results = searchDocuments([{ id: "station", title: "Cable car", kind: "Activity", fields: [
      { label: "Date", value: "December" },
      { label: "Description", value: "Booking ready" },
      { label: "Transport", value: "Use Exit B for the terminal" },
    ] }], "Exit B");
    expect(results[0].matches).toEqual([{ label: "Transport", value: "Use Exit B for the terminal" }]);
    expect(searchDocuments([{ id: "other", title: "Exit", kind: "Activity", fields: [{ label: "Notes", value: "Booking ready" }] }], "Exit B")).toEqual([]);
  });
});
