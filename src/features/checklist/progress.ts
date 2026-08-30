import type { ChecklistItem, Priority } from "../../types/domain";

export interface ChecklistProgress {
  completed: number;
  total: number;
  percent: number;
}

export function checklistProgress(items: ChecklistItem[], priority?: Priority): ChecklistProgress {
  const relevant = priority ? items.filter((item) => item.priority === priority) : items;
  const total = relevant.reduce((sum, item) => sum + item.targetCount, 0);
  const completed = relevant.reduce((sum, item) => sum + Math.min(item.completedCount, item.targetCount), 0);
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}
