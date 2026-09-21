import { describe, expect, it } from "vitest";
import { normalizeItineraryDetails } from "../src/features/itinerary/transport-details";

describe("transport detail normalization", () => {
  it("keeps every legacy option visible and identifies its one recommended option", () => {
    const details = normalizeItineraryDetails({
      transportOptions: [
        { label: "Bus 15", mode: "recommended", instructions: "The Peak → Central", durationMinutes: 45, cost: "~HK$13-15/person" },
        { label: "Taxi", mode: "fallback", instructions: "The Peak → Central", durationMinutes: 25, cost: "~HK$100-150 total" },
      ],
    });

    expect(details).toMatchObject({
      recommended: "Bus 15",
      transportOptions: [
        { name: "Bus 15", route: "The Peak → Central", approxDurationMinutes: 45, approxCost: "~HK$13-15/person" },
        { name: "Taxi", route: "The Peak → Central", approxDurationMinutes: 25, approxCost: "~HK$100-150 total" },
      ],
    });
  });

  it("returns no details for a missing optional payload", () => {
    expect(normalizeItineraryDetails(undefined)).toBeUndefined();
  });
});
