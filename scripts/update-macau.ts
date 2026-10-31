import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { equal, planUpdate, type Snapshot, type Update, type Row } from "./lib/scoped-trip-update";

const manifestArg = process.argv.find((arg) => arg.startsWith("--manifest="));
const manifest = manifestArg?.slice("--manifest=".length) ?? "macau-heritage-2026-10-31.json";
if (!["macau-2026-10-28.json", "macau-transport-2026-10-28.json", "macau-headers-2026-10-28.json", "macau-2026-10-29.json", "macau-heritage-2026-10-31.json"].includes(manifest)) throw new Error("Unknown reviewed Macau update manifest");
const update = JSON.parse(await readFile(new URL(`../data/updates/${manifest}`, import.meta.url), "utf8")) as Update;
const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
const client = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ["trips", "places", "bookings", "itinerary_days", "itinerary_items", "trip_notes", "checklist_items", "booking_files", "budgets", "payment_accounts", "financial_transactions"];
async function readSnapshot(): Promise<Snapshot> {
  const snapshot: Snapshot = {};
  for (const table of tables) {
    const { data, error } = await client.from(table).select("*").eq(table === "trips" ? "id" : "trip_id", update.tripId).order("id");
    if (error) throw new Error(`${table}: ${error.message}`);
    snapshot[table] = data as Row[];
  }
  return snapshot;
}
const before = await readSnapshot();
const operations = planUpdate(before, update);
for (const operation of operations) console.log(`${operation.kind}: ${operation.change.table} — ${operation.change.label}`);
console.log(`${operations.length} changes; ${process.argv.includes("--apply") ? "applying" : "dry run (pass --apply to save)"}.`);
if (!process.argv.includes("--apply") || !operations.length) process.exit(0);
const backupArg = process.argv.find((arg) => arg.startsWith("--backup="));
if (!backupArg) throw new Error("Provide --backup=/private/path.json for a private pre-update backup (never commit it)");
await writeFile(backupArg.slice("--backup=".length), JSON.stringify(before, null, 2), { mode: 0o600, flag: "wx" });
const owner = before.trips[0].owner_id;
for (const operation of operations) {
  const { change, current } = operation;
  if (operation.kind === "insert") {
    const { error } = await client.from(change.table).insert({ ...operation.values, id: change.id, trip_id: update.tripId, ...(["bookings", "itinerary_items", "trip_notes", "checklist_items"].includes(change.table) ? { created_by: owner, updated_by: owner } : {}) });
    if (error) throw new Error(`${change.label}: ${error.message}. Rerun dry run before retrying.`);
  } else {
    let query = operation.kind === "delete" ? client.from(change.table).delete() : client.from(change.table).update({ ...operation.values, updated_at: new Date().toISOString() });
    query = query.eq("id", change.id).eq("trip_id", update.tripId).eq("version", current!.version).eq("updated_at", current!.updated_at);
    // trip_notes has no version/timestamp bump trigger; compare every edited old field too.
    if (change.table === "trip_notes") for (const key of Object.keys(operation.values ?? {})) query = current![key] == null ? query.is(key, null) : query.eq(key, current![key]);
    if (change.table === "bookings") query = query.eq("status", "PLACEHOLDER");
    const { data, error } = await query.select("id").maybeSingle();
    if (error || !data) throw new Error(`${change.label}: ${error?.message ?? "Concurrent edit detected; newer value preserved"}. Rerun dry run before retrying.`);
  }
}
const after = await readSnapshot();
for (const table of ["trips", "booking_files", "budgets", "payment_accounts", "financial_transactions"]) if (!equal(before[table], after[table])) throw new Error(`${table} changed during update; inspect the private backup`);
for (const row of before.bookings.filter((item) => item.status !== "PLACEHOLDER")) if (!equal(row, after.bookings.find((item) => item.id === row.id))) throw new Error(`Confirmed booking changed: ${row.id}`);
if (planUpdate(after, update).length) throw new Error("Verification failed: remaining changes");
console.log("Saved and verified. Second application is a no-op; confirmed bookings, files and finances retained.");
