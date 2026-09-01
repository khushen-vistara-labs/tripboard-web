import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

type GuideNote = { section: string; title: string; body: string; summary?: string; icon?: string; copyText?: string; pronunciation?: string; meaning?: string; sortOrder?: number };
type Seed = { trip: { name: string; endDate: string }; importantNotes: GuideNote[]; places: { key: string; name: string; address?: string; googleMapsUrl?: string }[] };

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
const seed = JSON.parse(await readFile(new URL("../seed/hong-kong-2026.json", import.meta.url), "utf8")) as Seed;
const admin = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
const email = required("TRIPBOARD_SEED_OWNER_EMAIL");
const { data: owner, error: ownerError } = await admin.from("profiles").select("id").eq("email", email).single();
if (ownerError || !owner) throw ownerError ?? new Error("Seed owner not found");
const { data: trip, error: tripError } = await admin.from("trips").select("id").eq("owner_id", owner.id).eq("name", seed.trip.name).eq("end_date", seed.trip.endDate).single();
if (tripError || !trip) throw tripError ?? new Error("Seed trip not found");
const { data: existing, error: existingError } = await admin.from("trip_notes").select("id,title").eq("trip_id", trip.id);
if (existingError) throw existingError;
const byTitle = new Map((existing ?? []).map((note) => [note.title, note.id]));
let inserted = 0; let updated = 0;
for (const [index, note] of seed.importantNotes.entries()) {
  const payload = { trip_id: trip.id, section: note.section, title: note.title, body: note.body, summary: note.summary ?? null, icon: note.icon ?? null, copy_text: note.copyText ?? null, pronunciation: note.pronunciation ?? null, meaning: note.meaning ?? null, sort_order: note.sortOrder ?? index, updated_by: owner.id };
  const id = byTitle.get(note.title);
  const result = id ? await admin.from("trip_notes").update(payload).eq("id", id) : await admin.from("trip_notes").insert({ ...payload, created_by: owner.id });
  if (result.error) throw result.error;
  if (id) updated += 1; else inserted += 1;
}
const hotel = seed.places.find((place) => place.key === "bridal-tea-house");
if (!hotel?.address) throw new Error("The Trip Guide hotel address is missing from the seed.");
const { data: updatedHotel, error: hotelError } = await admin.from("places").update({ address: hotel.address, google_maps_url: hotel.googleMapsUrl ?? null }).eq("trip_id", trip.id).eq("name", hotel.name).select("id");
if (hotelError) throw hotelError;
if (!updatedHotel?.length) throw new Error("The Trip Guide hotel could not be found in the shared trip.");
console.log(`Trip Guide synced: ${updated} updated, ${inserted} added; hotel address refreshed.`);
