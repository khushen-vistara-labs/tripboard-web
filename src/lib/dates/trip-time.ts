import { DateTime } from "luxon";

export function inTripTimezone(utcIso: string, timezone: string): DateTime {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(timezone);
}

export function tripDateLabel(date: string, timezone: string): string {
  return DateTime.fromISO(date, { zone: timezone }).toLocaleString({ weekday: "long", day: "numeric", month: "long" });
}
