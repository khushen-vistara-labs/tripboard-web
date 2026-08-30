export type BudgetThreshold = 80 | 100;

export function crossedBudgetThreshold(previous: number, current: number, budget: number): BudgetThreshold | null {
  if (budget <= 0) return null;
  const before = (previous / budget) * 100;
  const after = (current / budget) * 100;
  if (before < 100 && after >= 100) return 100;
  if (before < 80 && after >= 80) return 80;
  return null;
}
