import { describe, expect, it } from "vitest";
import { budgetThresholdForPercent, lowWalletThreshold, preferenceAllows } from "../supabase/functions/_shared/notification-rules";
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
