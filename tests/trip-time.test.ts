import { Settings } from "luxon";
import { afterEach, describe, expect, it } from "vitest";
import { tripDateTimeInputValue, tripDateTimeToUtc } from "../src/lib/dates/trip-time";

afterEach(() => { Settings.defaultZone = "system"; });

describe("trip booking clocks", () => {
  for (const deviceZone of ["Asia/Kolkata", "Asia/Hong_Kong", "UTC", "America/Los_Angeles"]) {
    it(`keeps the typed clock through repeated save/reopen cycles on a ${deviceZone} device`, () => {
      Settings.defaultZone = deviceZone;
      for (const input of ["2026-12-27T14:00", "2026-12-27T00:15", "2026-12-27T23:45"]) {
        let value = input;
        for (let cycle = 0; cycle < 4; cycle++) {
          const stored = tripDateTimeToUtc(value, "Asia/Hong_Kong");
          expect(stored).toBeDefined();
          value = tripDateTimeInputValue(stored, "Asia/Hong_Kong");
          expect(value).toBe(input);
        }
      }
      expect(tripDateTimeToUtc("2026-12-27T14:00", "Asia/Hong_Kong")).toBe("2026-12-27T06:00:00.000Z");
    });
  }

  it("uses the trip date for legacy documents stored on the previous UTC day", () => {
    expect(tripDateTimeInputValue("2027-03-19T18:30:00+00:00", "Asia/Hong_Kong", true)).toBe("2027-03-20");
    for (const timezone of ["Asia/Hong_Kong", "America/Los_Angeles"]) {
      const stored = tripDateTimeToUtc("2027-03-20", timezone, true);
      expect(tripDateTimeInputValue(stored, timezone, true)).toBe("2027-03-20");
    }
  });

  it("keeps missing optional dates empty", () => {
    expect(tripDateTimeInputValue(undefined, "Asia/Hong_Kong")).toBe("");
    expect(tripDateTimeToUtc("", "Asia/Hong_Kong")).toBeUndefined();
  });

  it("rejects invalid dates and nonexistent daylight-saving clocks instead of changing the input", () => {
    expect(() => tripDateTimeToUtc("2026-02-30T14:00", "Asia/Hong_Kong")).toThrow("Enter a valid date and time.");
    expect(() => tripDateTimeToUtc("2026-03-08T02:30", "America/New_York")).toThrow("Enter a valid date and time.");
  });
});
