import { describe, expect, it } from "vitest";
import { businessFields, digest, planUpdate, type Change, type Snapshot, type Update } from "../scripts/lib/scoped-trip-update";
import manifest from "../data/updates/macau-2026-10-28.json";

const tripId = "trip";
const initial = (): Snapshot => ({ trips: [{ id: tripId, timezone: "Asia/Hong_Kong" }], itinerary_items: [{ id: "item", trip_id: tripId, title: "Old ferry", date: "2026-12-27", status: "PLANNED", version: 7, notes: "Traveller note" }], bookings: [], trip_notes: [], places: [], itinerary_days: [], checklist_items: [] });
const update = (changes: Change[]): Update => ({ tripId, timezone: "Asia/Hong_Kong", changes });
const change = (): Change => ({ table: "itinerary_items", id: "item", label: "Ferry", values: { title: "Morning ferry", date: "2026-12-28" }, before: { title: digest("Old ferry"), date: digest("2026-12-27") } });

describe("scoped trip update preservation", () => {
  it("patches only reviewed fields and accepts an already applied update", () => {
    const snapshot = initial();
    const [op] = planUpdate(snapshot, update([change()]));
    expect(op.kind).toBe("update");
    expect(op.values).toEqual({ title: "Morning ferry", date: "2026-12-28" });
    Object.assign(snapshot.itinerary_items[0], op.values, { version: 8 });
    expect(planUpdate(snapshot, update([change()]))).toEqual([]);
    expect(snapshot.itinerary_items[0].notes).toBe("Traveller note");
  });
  it("edits only the Macau sentence in a private guide and does not duplicate appended facts", () => {
    const snapshot = initial();
    snapshot.trip_notes.push({ id: "qa", trip_id: tripId, body: "User work details\nMacau day trip", version: 1 });
    const edit: Change = { table: "trip_notes", id: "qa", label: "Q&A", before: { body: digest("User work details\nMacau day trip") }, transforms: { body: { replace: [{ from: "Macau day trip", to: "Macau overnight" }], append: "\nHong Kong room retained" } } };
    const [op] = planUpdate(snapshot, update([edit]));
    expect(op.values?.body).toBe("User work details\nMacau overnight\nHong Kong room retained");
    Object.assign(snapshot.trip_notes[0], op.values);
    expect(planUpdate(snapshot, update([edit]))).toEqual([]);
    snapshot.trip_notes[0].body += "\nNewer personal fact";
    expect(planUpdate(snapshot, update([edit]))).toEqual([]);
  });
  it("preserves newer edited values and does not trust export versions", () => {
    const snapshot = initial(); snapshot.itinerary_items[0].title = "User’s newer ferry";
    expect(() => planUpdate(snapshot, update([change()]))).toThrow("Newer live value");
  });
  it("preserves confirmed bookings, attachments, references and amounts", () => {
    const snapshot = initial(); snapshot.bookings.push({ id: "booking", trip_id: tripId, title: "Booked ferry", status: "CONFIRMED", booking_reference: "KEEP", amount: 500 });
    expect(() => planUpdate(snapshot, update([{ table: "bookings", id: "booking", label: "Ferry", values: { title: "New ferry" }, before: { title: digest("Booked ferry") } }]))).toThrow("Preserving CONFIRMED booking");
    expect(snapshot.bookings[0].booking_reference).toBe("KEEP");
  });
  it.each(["COMPLETED", "SKIPPED"])("retains %s itinerary and checklist history", (status) => {
    const snapshot = initial(); snapshot.itinerary_items[0].status = status;
    expect(() => planUpdate(snapshot, update([change()]))).toThrow("Preserving historical");
  });
  it("requires the whole reviewed business record before deleting obsolete transfers", () => {
    const snapshot = initial(); const row = snapshot.itinerary_items[0];
    const removal: Change = { table: "itinerary_items", id: row.id, label: "Old transfer", remove: true, before: { record: digest(businessFields(row)) } };
    expect(planUpdate(snapshot, update([removal]))[0].kind).toBe("delete");
    row.notes = "New information";
    expect(() => planUpdate(snapshot, update([removal]))).toThrow("Newer live record");
  });
  it("reuses matching places and remaps their booking/itinerary links", () => {
    const snapshot = initial(); snapshot.places.push({ id: "existing-hotel", trip_id: tripId, name: "Treasure", priority: "WANT" });
    const ops = planUpdate(snapshot, update([
      { table: "places", id: "new-hotel", label: "Hotel", match: { name: "Treasure" }, values: { name: "Treasure", priority: "WANT" } },
      { table: "itinerary_items", id: "checkin", label: "Check in", values: { title: "Check in", place_id: "new-hotel" } },
    ]));
    expect(ops).toHaveLength(1); expect(ops[0].values?.place_id).toBe("existing-hotel");
  });
  it("does not change finances, server versions, traveller fields or booking references", () => {
    for (const key of ["version", "booking_reference", "travellers", "payment_account_id"]) expect(() => planUpdate(initial(), update([{ ...change(), values: { [key]: "forbidden" } }]))).toThrow("Protected field");
    expect(() => planUpdate(initial(), update([{ ...change(), table: "financial_transactions" as Change["table"] }]))).toThrow("outside this update");
    expect(() => planUpdate(initial(), { ...update([]), timezone: "Asia/Kolkata" })).toThrow("timezone");
  });
  it("refuses missing reviewed rows and ambiguous matches", () => {
    const snapshot = initial(); snapshot.itinerary_items = [];
    expect(() => planUpdate(snapshot, update([change()]))).toThrow("no longer exists");
    snapshot.places = [{ id: "a", name: "Treasure" }, { id: "b", name: "Treasure" }];
    expect(() => planUpdate(snapshot, update([{ table: "places", id: "c", label: "Hotel", match: { name: "Treasure" }, values: { name: "Treasure" } }]))).toThrow("Ambiguous");
  });
});

describe("reviewed Macau brief", () => {
  it("retains existing ferry/temple IDs and changes the overnight return date in UTC+8", () => {
    const lookup = (id: string) => manifest.changes.find((item) => item.id === id)?.values;
    expect(lookup("50498174-2ff7-4131-b400-931425406afa")?.starts_at).toBe("2026-12-27T00:30:00+00:00");
    expect(lookup("a45361c5-d99d-4e3a-9973-25e315f520bd")?.starts_at).toBe("2026-12-28T01:00:00+00:00");
    expect(lookup("86650a0d-0e3e-488e-aaf4-14e35cbbd83e")?.planned_start_time).toBe("12:25:00");
    expect(lookup("9fbabc05-ee81-48bf-ac52-ea02d5560d01")?.planned_end_time).toBe("14:35:00");
    expect(manifest.timezone).toBe("Asia/Hong_Kong");
    expect(new Date("2026-12-27T12:00:00+08:00").getUTCDay()).toBe(0);
    expect(new Date("2026-12-28T12:00:00+08:00").getUTCDay()).toBe(1);
  });
  it("keeps Treasure as an estimate and creates no financial or confirmed records", () => {
    const hotel = manifest.changes.find((item) => item.table === "bookings" && item.values?.type === "HOTEL")!;
    expect(hotel.values).toMatchObject({ amount: 4300, currency: "INR", status: "PLACEHOLDER" });
    expect(hotel.values?.notes).toContain("ESTIMATE ONLY");
    expect(manifest.changes.every((item) => !["financial_transactions", "booking_files", "budgets", "payment_accounts"].includes(item.table))).toBe(true);
    expect(manifest.changes.every((item) => item.values?.status !== "CONFIRMED")).toBe(true);
  });
  it("makes the three Macau alternatives untimed and fixes the bungy booking claim", () => {
    for (const id of ["ccc74da1-4fb6-40b7-ad2f-910e7c129e6a", "6b337c37-c089-4950-8765-f26505cd3948", "d7d11aad-5636-44b2-8128-8451f959cb4f"]) expect(manifest.changes.find((item) => item.id === id)?.values).toMatchObject({ planned_start_time: null, planned_end_time: null, expected_duration_minutes: null });
    const bungy = manifest.changes.find((item) => item.id === "149f6251-d038-47ae-a2c0-eae5d94b8f84")!;
    expect(bungy.values?.details?.booking).toBe("required");
    expect(bungy.values?.planned_start_time).toBe("13:30:00");
    expect(JSON.stringify(bungy)).not.toContain('"booking":"prebooked"');
  });
});
