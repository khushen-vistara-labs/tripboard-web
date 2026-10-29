import { describe, expect, it } from "vitest";
import revision from "../data/updates/macau-2026-10-29.json";
import previous from "../data/updates/macau-2026-10-28.json";
import { majorStops } from "../src/features/overview/TripOverviewScreen";
import type { ItineraryItem } from "../src/types/domain";

const changes = revision.changes as unknown as { table: string; id: string; values: Record<string, unknown> }[];
const value = (id: string) => changes.find((change) => change.id === id)?.values ?? {};
const effective = (id: string) => ({ ...previous.changes.find((change) => change.id === id)?.values, ...value(id) });
const travelChanges = changes.filter((change) => (change.values.details as { transportOptions?: unknown } | undefined)?.transportOptions);

describe("October 29 Macau acceptance requirements", () => {
  it("keeps compact headers, exact revised themes, and the applied Saturday out of scope", () => {
    expect(value("c7b97815-7fbe-44ab-b71d-3b699f45d42d").title).toBe("Macau • Heritage • Bungy • Cotai");
    expect(value("8762dac6-a762-453b-a698-bd8a55ba7e3c").title).toBe("Macau Return • Temples • Kowloon Markets");
    expect(changes.filter((change) => change.table === "itinerary_days").every((change) => !("notes" in change.values))).toBe(true);
    expect(changes.some((change) => change.id === "19dce530-942d-44aa-8bcf-611bcb64f5c5" || change.values.date === "2026-12-26")).toBe(false);
  });

  it("populates all 17 changed travel cards with numeric scoped costs, duration and an exact recommendation", () => {
    expect(travelChanges).toHaveLength(17);
    for (const change of travelChanges) {
      const details = change.values.details as { recommended: string; transportOptions: { name: string; route: string; approxCost: string; approxDurationMinutes: number; notes?: string }[] };
      expect(details.transportOptions.filter((option) => option.name === details.recommended)).toHaveLength(1);
      for (const option of details.transportOptions) {
        expect(option.route.length).toBeGreaterThan(10);
        expect(option.approxDurationMinutes).toBeGreaterThan(0);
        expect(option.approxCost).toMatch(/(?:HKD|MOP)\d/);
        expect(option.approxCost).toMatch(/\/(?:car|person|two)|(?:MOP|HKD)0/);
      }
    }
    const hk = value("0762506b-9d0b-4798-aa3b-c2faf25f6f4f").details as { recommended: string; transportOptions: { approxCost: string }[] };
    expect(hk.recommended).toBe("Taxi");
    expect(hk.transportOptions[0].approxCost).toBe("HKD180–260/car");
    expect(hk.transportOptions[1].approxCost).toContain("HKD15–25/person");
  });

  it("reuses the ferry and hotel IDs, stores the correct local dates and keeps costs as estimates", () => {
    expect(value("50498174-2ff7-4131-b400-931425406afa")).toMatchObject({ starts_at: "2026-12-26T23:30:00+00:00", amount: 424, currency: "HKD" });
    expect(value("a45361c5-d99d-4e3a-9973-25e315f520bd")).toMatchObject({ amount: 384, currency: "MOP" });
    expect(value("edce73c1-e39e-52ee-b4fd-97c1dc08b737")).toMatchObject({ title: "Asia Boutique Inn", amount: 6500, ends_at: "2026-12-27T23:15:00+00:00" });
    expect(value("edce73c1-e39e-52ee-b4fd-97c1dc08b737").notes).toContain("INR6,500");
    expect(value("edce73c1-e39e-52ee-b4fd-97c1dc08b737").notes).toContain("PLACEHOLDER");
    expect(changes.some((change) => ["booking_files", "financial_transactions", "payment_accounts", "budgets"].includes(change.table))).toBe(false);
    expect(changes.some((change) => change.values.status === "CONFIRMED" || "version" in change.values)).toBe(false);
  });

  it("restores the existing Wharf, keeps 13:30 bungy check-in and has one hour for both Galaxy lobbies", () => {
    expect(value("6b337c37-c089-4950-8765-f26505cd3948")).toMatchObject({ title: "Fisherman's Wharf", planned_start_time: "09:15:00", planned_end_time: "09:50:00", priority: "WANT" });
    expect(effective("149f6251-d038-47ae-a2c0-eae5d94b8f84")).toMatchObject({ planned_start_time: "13:30:00", expected_duration_minutes: 150 });
    const galaxy = changes.find((change) => change.values.title === "Galaxy shows & interiors")!.values;
    expect(galaxy).toMatchObject({ planned_start_time: "17:15:00", planned_end_time: "18:15:00" });
    expect(galaxy.transport_instructions).toMatch(/BOTH Diamond.*Crystal/);
    const mgm = changes.find((change) => change.values.title === "MGM Cotai interiors")!.values;
    expect(mgm).toMatchObject({ planned_start_time: "22:00:00", planned_end_time: "22:25:00" });
    expect(mgm.transport_instructions).toContain("does not promise a dolphin or garden show");
    expect(value("741020b2-fc98-409a-a35c-cd50464f50d6")).toMatchObject({ planned_start_time: "22:45:00", planned_end_time: "23:15:00" });
  });

  it("uses Pai Kok on Monday, leaves formalities and post-ferry records untouched, and does not rename Treasure", () => {
    const monday = value("5b3d1396-6ae9-58bb-b85b-ec676f4a44ea");
    expect(monday.transport_instructions).toContain("Pai Kok");
    expect(JSON.stringify(monday)).not.toMatch(/Airport|Treasure/);
    expect(changes.some((change) => change.id === "97dda7d9-f7ef-41d3-b053-cadac36bf003" || change.id === "b3950a17-4b6d-44ec-ad75-7446967b5a91")).toBe(false);
    expect(value("35fdb6d2-dc7d-56d1-b1cd-4c12c4a8d720").name).toBeUndefined();
    expect(value("35fdb6d2-dc7d-56d1-b1cd-4c12c4a8d720").notes).toContain("Unused former proposal");
  });

  it("excludes untimed substitutions from the overview’s core route while retaining timed visits", () => {
    const items = [
      { id: "galaxy", title: "Galaxy shows & interiors", priority: "MUST", plannedStartTime: "17:15" },
      { id: "mgm", title: "MGM Cotai interiors", priority: "MUST", plannedStartTime: "22:00" },
      { id: "guard", title: "Changing of the Guard", priority: "OPTIONAL" },
      { id: "fort", title: "Monte Fort", priority: "OPTIONAL" },
    ].map((item, sequence) => ({ ...item, sequence, type: "attraction", tripId: "trip", date: "2026-12-27", status: "PLANNED" })) as ItineraryItem[];
    expect(majorStops(items).map((item) => item.id)).toEqual(["galaxy", "mgm"]);
  });
});
