export type SyncFailureKind = "CONFLICT" | "RETRYABLE" | "REJECTED";

export function classifySyncFailure(error: unknown): SyncFailureKind {
  const value = error as { code?: string; status?: number; message?: string } | null;
  const code = value?.code ?? "";
  const status = value?.status ?? 0;
  const message = value?.message ?? (error instanceof Error ? error.message : String(error ?? ""));
  if (code === "40001" || code === "PGRST116" || /version conflict|stale version|conflict/i.test(message)) return "CONFLICT";
  if (status >= 500 || status === 0 && /fetch|network|offline|timeout|connection/i.test(message)) return "RETRYABLE";
  return "REJECTED";
}

export function mutationSummary(entity: string, command: string): string {
  const label = entity === "booking-file" ? "booking file" : entity === "notification-preference" ? "alert preference" : entity.replaceAll("-", " ");
  const action: Record<string, string> = { create: "Add", update: "Edit", delete: "Delete", upsert: "Save", move: "Move", reorder: "Reorder", settle: "Settle", void: "Void", upload: "Upload", replace: "Replace", remove: "Remove", "revoke-invite": "Revoke invite", "day-upsert": "Edit travel day" };
  return `${action[command] ?? command} ${label}`;
}
