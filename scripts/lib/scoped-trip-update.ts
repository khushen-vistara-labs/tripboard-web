import { createHash } from "node:crypto";

export type Row = Record<string, unknown> & { id: string };
export const writableTables = ["places", "bookings", "itinerary_days", "itinerary_items", "trip_notes", "checklist_items"] as const;
export type Table = typeof writableTables[number];
export type Snapshot = Record<string, Row[]>;
export interface Change { table: Table; id: string; label: string; values?: Record<string, unknown>; before?: Record<string, string>; remove?: boolean; match?: Record<string, unknown>; transforms?: Record<string, { replace?: { from: string; to: string }[]; append?: string }> }
export interface Update { tripId: string; timezone: string; changes: Change[] }
export interface Operation { change: Change; kind: "insert" | "update" | "delete"; current?: Row; values?: Record<string, unknown> }
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)])) : value ?? null;
export const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export const businessFields = (row: Row) => Object.fromEntries(Object.entries(row).filter(([key]) => !["created_at", "updated_at", "created_by", "updated_by", "version"].includes(key)));

/** Three-way field comparison: only the reviewed old value or the desired value is accepted. */
export function planUpdate(snapshot: Snapshot, update: Update): Operation[] {
  const trip = snapshot.trips?.find((row) => row.id === update.tripId);
  if (!trip || trip.timezone !== update.timezone) throw new Error("Trip identity or timezone differs from the reviewed update");
  const ids = new Set<string>();
  const aliases = new Map<string, string>();
  for (const change of update.changes) {
    if (!writableTables.includes(change.table)) throw new Error(`Table is outside this update: ${change.table}`);
    if (ids.has(change.id)) throw new Error(`Duplicate change ID: ${change.id}`);
    ids.add(change.id);
    if (change.match) {
      const matches = snapshot[change.table].filter((row) => Object.entries(change.match!).every(([key, value]) => equal(row[key], value)));
      if (matches.length > 1) throw new Error(`Ambiguous existing match: ${change.label}`);
      if (matches.length === 1) aliases.set(change.id, matches[0].id);
    }
  }
  const operations: Operation[] = [];
  for (const original of update.changes) {
    const change = { ...original, id: aliases.get(original.id) ?? original.id };
    const current = snapshot[change.table].find((row) => row.id === change.id);
    if (current && current.trip_id !== update.tripId) throw new Error(`Wrong trip: ${change.label}`);
    if (change.remove) {
      if (!current) continue;
      if (current.status !== "PLANNED" || current.completed_at || Number(current.completed_count ?? 0) > 0) throw new Error(`Preserving historical record: ${change.label}`);
      if (digest(businessFields(current)) !== change.before?.record) throw new Error(`Newer live record conflicts with removal: ${change.label}`);
      operations.push({ change, kind: "delete", current });
      continue;
    }
    const transformed: Record<string, unknown> = {};
    for (const [key, transform] of Object.entries(change.transforms ?? {})) {
      if (!current || typeof current[key] !== "string") throw new Error(`Missing text to transform: ${change.label}`);
      let value = current[key] as string;
      for (const replacement of transform.replace ?? []) {
        if (value.includes(replacement.to)) continue;
        if (!value.includes(replacement.from)) throw new Error(`Newer live text conflicts: ${change.label}`);
        value = value.replaceAll(replacement.from, replacement.to);
      }
      if (transform.append && !value.includes(transform.append)) value += transform.append;
      transformed[key] = value;
    }
    const values = Object.fromEntries(Object.entries({ ...change.values, ...transformed }).map(([key, value]) => [key, typeof value === "string" && key.endsWith("_id") ? aliases.get(value) ?? value : value]));
    for (const key of Object.keys(values)) if (["id", "trip_id", "version", "created_at", "updated_at", "created_by", "updated_by", "completed_at", "completed_by", "payment_account_id", "booking_reference", "travellers"].includes(key)) throw new Error(`Protected field: ${key}`);
    if ("completed_count" in values && (values.completed_count !== 0 || (current && !equal(current.completed_count, values.completed_count)))) throw new Error(`Protected completion count: ${change.label}`);
    if (!current) {
      if (change.before) throw new Error(`Reviewed record no longer exists: ${change.label}`);
      operations.push({ change, kind: "insert", values });
      continue;
    }
    const patch = Object.fromEntries(Object.entries(values).filter(([key, value]) => !equal(current[key], value)));
    if (!Object.keys(patch).length) continue;
    if (change.table === "bookings" && current.status !== "PLACEHOLDER") throw new Error(`Preserving ${current.status} booking: ${change.label}`);
    if (["itinerary_items", "checklist_items"].includes(change.table) && (current.status === "COMPLETED" || current.status === "SKIPPED" || current.completed_at || Number(current.completed_count ?? 0) > 0)) throw new Error(`Preserving historical progress: ${change.label}`);
    for (const key of Object.keys(patch)) if (digest(current[key]) !== change.before?.[key]) throw new Error(`Newer live value conflicts: ${change.label} / ${key}`);
    operations.push({ change, kind: "update", current, values: patch });
  }
  return operations.sort((a, b) => Number(a.kind === "delete") - Number(b.kind === "delete"));
}
