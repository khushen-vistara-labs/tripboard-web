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
