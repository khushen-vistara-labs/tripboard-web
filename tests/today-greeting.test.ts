import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { greetingForHour } from "../src/features/today/greeting";

describe("Today greeting", () => {
  it("switches between morning, afternoon, and evening at the time boundaries", () => {
    for (const hour of [5, 8, 11]) expect(greetingForHour(hour).text).toBe("Good morning");
    for (const hour of [12, 14, 16]) expect(greetingForHour(hour).text).toBe("Good afternoon");
    for (const hour of [17, 21, 23, 0, 4]) expect(greetingForHour(hour).text).toBe("Good evening");
    expect(greetingForHour(21).glyph).toBe("☾");
  });

  it("follows the trip timezone rather than the UTC hour", () => {
    const instant = DateTime.fromISO("2026-12-28T04:00:00Z");
    expect(greetingForHour(instant.setZone("Asia/Hong_Kong").hour).text).toBe("Good afternoon");
    expect(greetingForHour(instant.setZone("Asia/Kolkata").hour).text).toBe("Good morning");
  });
});
