import { DateTime } from "luxon";
import type { ItineraryItem } from "../../types/domain";

export type TemporalState = "UPCOMING" | "OVERDUE" | "UNRESOLVED" | "DONE" | "SKIPPED";

export function itineraryTemporalState(
  item: ItineraryItem,
  nowIso: string,
  tripTimezone: string,
  graceMinutes = 30,
): TemporalState {
  if (item.status === "COMPLETED") return "DONE";
  if (item.status === "SKIPPED") return "SKIPPED";

  const now = DateTime.fromISO(nowIso, { setZone: true }).setZone(tripTimezone);
  const dayEnd = DateTime.fromISO(item.date, { zone: tripTimezone }).endOf("day");
  if (now > dayEnd && !item.plannedStartTime) return "UNRESOLVED";

  const endTime = item.plannedEndTime ?? item.plannedStartTime;
  if (!endTime) return now > dayEnd ? "UNRESOLVED" : "UPCOMING";
  let deadline = DateTime.fromISO(`${item.date}T${endTime}`, { zone: tripTimezone });
  if (!item.plannedEndTime) deadline = deadline.plus({ minutes: item.expectedDurationMinutes ?? 0 });
  deadline = deadline.plus({ minutes: graceMinutes });
  return now > deadline ? (now > dayEnd ? "UNRESOLVED" : "OVERDUE") : "UPCOMING";
}

export function rankWhatNow(items: ItineraryItem[], nowIso: string, tripTimezone: string): ItineraryItem[] {
  const now = DateTime.fromISO(nowIso, { setZone: true }).setZone(tripTimezone);
  const priorityWeight = { MUST: 0, WANT: 1, OPTIONAL: 2 } as const;
  return items
    .filter((item) => item.status === "PLANNED")
    .sort((a, b) => {
      const priority = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (priority) return priority;
      const aToday = a.date === now.toISODate() ? 0 : 1;
      const bToday = b.date === now.toISODate() ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      return (a.expectedDurationMinutes ?? 60) - (b.expectedDurationMinutes ?? 60);
    });
}
