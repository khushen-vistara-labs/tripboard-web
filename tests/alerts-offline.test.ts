import { describe, expect, it } from "vitest";
import { budgetThresholdForPercent, dailySummaryCandidates, lowWalletThreshold, preferenceAllows } from "../supabase/functions/_shared/notification-rules";
import { classifySyncFailure, mutationSummary } from "../src/lib/offline/conflicts";

describe("alert evaluator rules", () => {
  const disabled = { morning_summary: false, leave_soon: false, overdue_item: false, end_of_day: false, budget_warning: false, booking_reminder: false, low_wallet: false };

  it("enforces every saved notification preference", () => {
    for (const type of ["MORNING_SUMMARY", "LEAVE_SOON", "OVERDUE_ITEM", "END_OF_DAY", "BUDGET_WARNING", "BOOKING_REMINDER", "LOW_WALLET"]) expect(preferenceAllows(type, disabled)).toBe(false);
  });

  it("defaults ordinary alerts on and low-wallet alerts off", () => {
    expect(preferenceAllows("BOOKING_REMINDER")).toBe(true);
    expect(preferenceAllows("LOW_WALLET")).toBe(false);
  });

  it("uses the highest newly relevant budget threshold and currency-aware wallet floors", () => {
    expect(budgetThresholdForPercent(79.9)).toBeNull();
    expect(budgetThresholdForPercent(80)).toBe(80);
    expect(budgetThresholdForPercent(105)).toBe(100);
    expect(lowWalletThreshold("HKD")).toBe(100);
    expect(lowWalletThreshold("INR")).toBe(500);
  });

  const summary = { name: "Hong Kong", startDate: "2026-12-24", endDate: "2027-01-02", date: "2026-12-28", minutes: 1290 };

  it("never creates morning or review alerts for empty or fully resolved days", () => {
    for (const minutes of [420, 1290]) {
      expect(dailySummaryCandidates({ ...summary, minutes, items: [] })).toEqual([]);
      expect(dailySummaryCandidates({ ...summary, minutes, items: [{ status: "COMPLETED" }, { status: "SKIPPED" }] })).toEqual([]);
    }
  });

  it("does not create daily summaries before or after the trip", () => {
    for (const date of ["2026-10-27", "2027-01-03"]) {
      expect(dailySummaryCandidates({ ...summary, date, items: [{ status: "PLANNED" }] })).toEqual([]);
    }
  });

  it("includes moved activities and only counts pending items in the review", () => {
    const candidates = dailySummaryCandidates({ ...summary, items: [{ status: "MOVED" }, { status: "COMPLETED" }, { status: "SKIPPED" }] });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ type: "END_OF_DAY", url: "/plan?date=2026-12-28", dedupeKey: "review:2026-12-28" });
    expect(candidates[0].body).toMatch(/^1 activity still needs a decision/);
  });

  it("uses the earliest pending departure in actionable morning summaries", () => {
    const candidates = dailySummaryCandidates({ ...summary, minutes: 420, items: [
      { status: "COMPLETED", recommended_departure_time: "06:00:00" },
      { status: "PLANNED", recommended_departure_time: "09:15:00" },
      { status: "MOVED", recommended_departure_time: "08:30:00" },
    ] });
    expect(candidates[0]).toMatchObject({ type: "MORNING_SUMMARY", body: "2 activities planned. First departure at 8:30 AM." });
  });

  it("keeps summaries inside their scheduled windows, including the trip boundaries", () => {
    expect(dailySummaryCandidates({ ...summary, minutes: 480, items: [{ status: "PLANNED" }] })).toEqual([]);
    expect(dailySummaryCandidates({ ...summary, minutes: 1350, items: [{ status: "PLANNED" }] })).toEqual([]);
    expect(dailySummaryCandidates({ ...summary, date: summary.startDate, items: [{ status: "PLANNED" }] })).toHaveLength(1);
    expect(dailySummaryCandidates({ ...summary, date: summary.endDate, items: [{ status: "PLANNED" }] })).toHaveLength(1);
  });
});

describe("offline conflict policy", () => {
  it("distinguishes version conflicts, retryable network errors, and server rejections", () => {
    expect(classifySyncFailure({ code: "40001", message: "stale" })).toBe("CONFLICT");
    expect(classifySyncFailure(new Error("Network connection failed"))).toBe("RETRYABLE");
    expect(classifySyncFailure({ code: "42501", message: "not authorised" })).toBe("REJECTED");
  });

  it("describes queued changes without exposing implementation names", () => {
    expect(mutationSummary("notification-preference", "upsert")).toBe("Save alert preference");
    expect(mutationSummary("booking-file", "replace")).toBe("Replace booking file");
  });
});
