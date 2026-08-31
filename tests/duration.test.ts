import { describe, expect, it } from "vitest";
import { formatDuration } from "../src/lib/dates/duration";

describe("formatDuration", () => {
  it("keeps short durations in minutes", () => expect(formatDuration(45)).toBe("45 min"));
  it("condenses long durations into hours and minutes", () => {
    expect(formatDuration(60)).toBe("60 min");
    expect(formatDuration(65)).toBe("1 hr 5 min");
    expect(formatDuration(285)).toBe("4 hrs 45 min");
  });
});
