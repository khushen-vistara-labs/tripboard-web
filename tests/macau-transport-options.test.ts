import { describe, expect, it } from "vitest";
import original from "../data/updates/macau-2026-10-28.json";
import correction from "../data/updates/macau-transport-2026-10-28.json";
import { digest, planUpdate, type Snapshot, type Update } from "../scripts/lib/scoped-trip-update";
import { normalizeItineraryDetails } from "../src/features/itinerary/transport-details";

describe("Macau transport-box correction", () => {
  it("restores visible structured choices with an exact recommended option on all 22 revised legs", () => {
    expect(correction.changes).toHaveLength(22);
    for (const change of correction.changes) {
      const details = normalizeItineraryDetails(change.values.details)!;
      expect(details.transportOptions?.length, change.label).toBeGreaterThan(0);
      expect(details.transportOptions?.filter((option) => option.name === details.recommended), change.label).toHaveLength(1);
      expect(details.transportOptions?.every((option) => option.route && option.approxCost), change.label).toBe(true);
    }
    for (const id of ["c290eaa5-8227-44c9-a584-770e548089ea", "0762506b-9d0b-4798-aa3b-c2faf25f6f4f", "b3950a17-4b6d-44ec-ad75-7446967b5a91"]) expect(correction.changes.some((change) => change.id === id)).toBe(true);
  });

  it("changes only structured itinerary details and retains the overnight notes and booking warnings", () => {
    for (const change of correction.changes) {
      expect(change.table).toBe("itinerary_items");
      expect(Object.keys(change.values)).toEqual(["details"]);
      const priorDetails = original.changes.find((item) => item.id === change.id)?.values?.details;
      expect(digest(priorDetails), change.label).toBe(change.before.details);
      for (const [key, value] of Object.entries(priorDetails ?? {})) {
        if (key !== "recommended") expect((change.values.details as Record<string, unknown>)[key], `${change.label}: ${key}`).toEqual(value);
      }
      expect(JSON.stringify(change.values.details)).not.toContain('"booking":"prebooked"');
    }
  });

  it("applies once and refuses newer conflicting detail edits", () => {
    const snapshot: Snapshot = {
      trips: [{ id: correction.tripId, timezone: correction.timezone }],
      itinerary_items: correction.changes.map((change) => ({ id: change.id, trip_id: correction.tripId, status: "PLANNED", details: original.changes.find((item) => item.id === change.id)?.values?.details })),
    };
    const update = correction as Update;
    const operations = planUpdate(snapshot, update);
    expect(operations).toHaveLength(22);
    for (const operation of operations) Object.assign(snapshot.itinerary_items.find((row) => row.id === operation.change.id)!, operation.values);
    expect(planUpdate(snapshot, update)).toEqual([]);
    snapshot.itinerary_items[0].details = { quickNote: "A newer traveller edit" };
    expect(() => planUpdate(snapshot, update)).toThrow("Newer live value conflicts");
  });
});
