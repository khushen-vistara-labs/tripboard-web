import { DateTime } from "luxon";

export function inTripTimezone(utcIso: string, timezone: string): DateTime {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(timezone);
}

export function tripDateLabel(date: string, timezone: string): string {
  return DateTime.fromISO(date, { zone: timezone }).toLocaleString({ weekday: "long", day: "numeric", month: "long" });
}

/** A datetime-local input is a wall clock in the trip, never the device's zone. */
export function tripDateTimeInputValue(utcIso: string | undefined, timezone: string, dateOnly = false): string {
  if (!utcIso) return "";
  return inTripTimezone(utcIso, timezone).toFormat(dateOnly ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
}

export function tripDateTimeToUtc(value: string, timezone: string, dateOnly = false): string | undefined {
  if (!value) return undefined;
  const input = dateOnly ? value.slice(0, 10) : value;
  const parsed = DateTime.fromISO(input, { zone: timezone });
  // Reject invalid dates and clocks skipped by a daylight-saving transition.
  if (!parsed.isValid || tripDateTimeInputValue(parsed.toISO() ?? undefined, timezone, dateOnly) !== input) {
    throw new Error("Enter a valid date and time.");
  }
  return parsed.toUTC().toISO()!;
}
