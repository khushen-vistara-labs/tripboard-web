export type NotificationPreference = Record<string, unknown> | undefined;

export function preferenceAllows(type: string, preference?: NotificationPreference) {
  if (!preference) return type !== "LOW_WALLET";
  const column: Record<string, string> = { MORNING_SUMMARY: "morning_summary", LEAVE_SOON: "leave_soon", OVERDUE_ITEM: "overdue_item", END_OF_DAY: "end_of_day", BUDGET_WARNING: "budget_warning", BOOKING_REMINDER: "booking_reminder", LOW_WALLET: "low_wallet" };
  const key = column[type];
  return key ? preference[key] !== false : true;
}

export function lowWalletThreshold(currency: string) {
  return currency === "INR" ? 500 : 100;
}

export function budgetThresholdForPercent(percent: number): 80 | 100 | null {
  return percent >= 100 ? 100 : percent >= 80 ? 80 : null;
}

export interface NotificationCandidate {
  type: string;
  entityId?: string;
  title: string;
  body: string;
  dedupeKey: string;
  url: string;
}

export interface DailySummaryContext {
  name: string;
  date: string;
  minutes: number;
  startDate: string;
  endDate: string;
  items: { status: string; recommended_departure_time?: string | null }[];
}

export function dailySummaryCandidates(context: DailySummaryContext): NotificationCandidate[] {
  if (context.date < context.startDate || context.date > context.endDate) return [];
  const pending = context.items.filter((item) => item.status === "PLANNED" || item.status === "MOVED");
  if (pending.length === 0) return [];
  const count = pending.length;
  const noun = count === 1 ? "activity" : "activities";
  if (context.minutes >= 420 && context.minutes < 480) {
    const departure = pending.map((item) => item.recommended_departure_time).filter((time): time is string => Boolean(time)).sort()[0];
    let firstDeparture = "";
    if (departure) {
      const [hour, minute] = departure.split(":").map(Number);
      firstDeparture = ` First departure at ${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}.`;
    }
    return [{ type: "MORNING_SUMMARY", title: `${context.name} today`, body: `${count} ${noun} planned.${firstDeparture}`, dedupeKey: `morning:${context.date}`, url: "/today" }];
  }
  if (context.minutes >= 1290 && context.minutes < 1350) {
    return [{ type: "END_OF_DAY", title: "Review today", body: `${count} ${noun} still ${count === 1 ? "needs" : "need"} a decision. Mark done, move, skip, or leave unresolved.`, dedupeKey: `review:${context.date}`, url: `/plan?date=${context.date}` }];
  }
  return [];
}
