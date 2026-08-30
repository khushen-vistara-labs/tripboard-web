import { describe, expect, it } from "vitest";
import { itineraryTemporalState, reorderIds } from "../src/features/itinerary/rules";
import { crossedBudgetThreshold } from "../src/features/budgets/thresholds";
import { calculateBudgetUsage } from "../src/features/budgets/usage";
import { checklistProgress } from "../src/features/checklist/progress";
import type { ChecklistItem, ItineraryItem } from "../src/types/domain";

const itinerary: ItineraryItem = { id: "1", tripId: "trip", date: "2026-12-28", title: "Ferry", type: "transport", plannedStartTime: "10:00", expectedDurationMinutes: 30, priority: "MUST", status: "PLANNED", sequence: 1 };

describe("trip rules", () => {
  it("derives overdue in the trip timezone after duration and grace", () => {
    expect(itineraryTemporalState(itinerary, "2026-12-28T03:01:00Z", "Asia/Hong_Kong")).toBe("OVERDUE");
  });

  it("does not derive overdue before the deadline", () => {
    expect(itineraryTemporalState(itinerary, "2026-12-28T02:30:00Z", "Asia/Hong_Kong")).toBe("UPCOMING");
  });

  it("emits budget thresholds only when newly crossed", () => {
    expect(crossedBudgetThreshold(79, 82, 100)).toBe(80);
    expect(crossedBudgetThreshold(81, 85, 100)).toBeNull();
    expect(crossedBudgetThreshold(95, 101, 100)).toBe(100);
  });

  it("keeps must completion separate from optional items", () => {
    const items: ChecklistItem[] = [
      { id: "1", tripId: "t", title: "A", kind: "PLACE", priority: "MUST", targetCount: 1, completedCount: 1, status: "COMPLETED" },
      { id: "2", tripId: "t", title: "B", kind: "FOOD", priority: "MUST", targetCount: 1, completedCount: 0, status: "PLANNED" },
      { id: "3", tripId: "t", title: "C", kind: "OTHER", priority: "OPTIONAL", targetCount: 1, completedCount: 1, status: "COMPLETED" },
    ];
    expect(checklistProgress(items, "MUST")).toMatchObject({ completed: 1, total: 2, percent: 50 });
    expect(checklistProgress(items, "OPTIONAL")).toMatchObject({ completed: 1, total: 1, percent: 100 });
  });

  it("reorders itinerary ids without mutating the original list", () => {
    const original = ["breakfast", "museum", "dinner"];
    expect(reorderIds(original, "breakfast", "dinner")).toEqual(["museum", "dinner", "breakfast"]);
    expect(original).toEqual(["breakfast", "museum", "dinner"]);
  });

  it("ignores invalid or unchanged itinerary reorder requests", () => {
    expect(reorderIds(["a", "b"], "a", "a")).toBeNull();
    expect(reorderIds(["a", "b"], "missing", "b")).toBeNull();
  });

  it("calculates trip, category, and daily budget usage from purchases minus refunds", () => {
    const events = [
      { id: "p1", idempotencyKey: "p1", type: "PURCHASE" as const, occurredAt: "2026-12-28T02:00:00Z", description: "Lunch", category: "Food", consumptionAmount: "100", consumptionCurrency: "HKD" },
      { id: "r1", idempotencyKey: "r1", type: "PURCHASE_REFUND" as const, occurredAt: "2026-12-28T03:00:00Z", description: "Refund", category: "Food", consumptionAmount: "20", consumptionCurrency: "HKD" },
      { id: "p2", idempotencyKey: "p2", type: "PURCHASE" as const, occurredAt: "2026-12-29T02:00:00Z", description: "Train", category: "Transport", consumptionAmount: "40", consumptionCurrency: "HKD" },
    ];
    expect(calculateBudgetUsage({ id: "t", tripId: "trip", amount: "200", currency: "HKD", scope: "TRIP" }, events, "Asia/Hong_Kong")).toMatchObject({ spent: "120", percent: 60 });
    expect(calculateBudgetUsage({ id: "c", tripId: "trip", amount: "100", currency: "HKD", scope: "CATEGORY", category: "Food" }, events, "Asia/Hong_Kong")).toMatchObject({ spent: "80", percent: 80 });
    expect(calculateBudgetUsage({ id: "d", tripId: "trip", amount: "160", currency: "HKD", scope: "DAILY", date: "2026-12-28" }, events, "Asia/Hong_Kong")).toMatchObject({ spent: "80", percent: 50 });
  });
});
