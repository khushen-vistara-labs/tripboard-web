import Decimal from "decimal.js";
import { DateTime } from "luxon";
import type { Budget } from "../../types/domain";
import type { FinancialEvent } from "../money/domain";

export interface BudgetUsage {
  spent: string;
  amount: string;
  remaining: string;
  percent: number;
}

export function calculateBudgetUsage(budget: Budget, events: FinancialEvent[], timezone: string): BudgetUsage {
  const spent = events.reduce((sum, event) => {
    if (event.voidedAt || !["PURCHASE", "PURCHASE_REFUND"].includes(event.type)) return sum;
    const currency = event.consumptionCurrency ?? event.destinationCurrency ?? event.sourceCurrency;
    if (currency !== budget.currency) return sum;
    if (budget.scope === "CATEGORY" && (event.category ?? "Miscellaneous") !== budget.category) return sum;
    if (budget.scope === "DAILY" && DateTime.fromISO(event.occurredAt).setZone(timezone).toISODate() !== budget.date) return sum;
    const value = new Decimal(event.consumptionAmount ?? event.destinationAmount ?? event.sourceAmount ?? 0);
    return event.type === "PURCHASE_REFUND" ? sum.minus(value) : sum.plus(value);
  }, new Decimal(0));
  const amount = new Decimal(budget.amount || 0);
  const percent = amount.isPositive() ? Math.max(0, spent.div(amount).times(100).toNumber()) : 0;
  return {
    spent: Decimal.max(spent, 0).toString(),
    amount: amount.toString(),
    remaining: Decimal.max(amount.minus(spent), 0).toString(),
    percent,
  };
}

export function budgetLabel(budget: Budget): string {
  if (budget.scope === "CATEGORY") return `${budget.category ?? "Category"} budget`;
  if (budget.scope === "DAILY") return `Daily budget · ${budget.date ?? "No date"}`;
  return "Whole-trip budget";
}
