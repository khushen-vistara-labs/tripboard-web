import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Priority = z.enum(["MUST", "WANT", "OPTIONAL"]);
const TimingType = z.enum(["FIXED", "TARGET", "FLEXIBLE", "OPTIONAL", "WEATHER_DEPENDENT", "BUFFER"]);
const CostScope = z.enum(["PERSON", "PARTY"]);
const CostStatus = z.enum(["COMMITTED", "EXPECTED", "OPTIONAL"]);
const ItineraryDetails = z.object({
  transportOptions: z.array(z.object({ name: z.string().min(1), approxDurationMinutes: z.number().int().positive(), approxCost: z.string().min(1), route: z.string().min(1), notes: z.string().optional() })).optional(),
  recommended: z.string().optional(),
  farePerPerson: z.string().optional(), fareForTwo: z.string().optional(), attractionCost: z.string().optional(),
  booking: z.enum(["required", "prebooked", "optional", "not-required"]).optional(),
  foodNearby: z.array(z.string()).optional(), dietaryNote: z.string().optional(), weather: z.string().optional(), carry: z.array(z.string()).optional(), payWith: z.string().optional(), fallback: z.string().optional(), hotelReturn: z.string().optional(), quickNote: z.string().optional(),
  crowdNote: z.string().optional(), operatingHours: z.string().optional(), eventStatus: z.string().optional(), planningAssumption: z.string().optional(), priorityRule: z.string().optional(), hoursStatus: z.string().optional(), costStatus: z.string().optional(),
});
export const SeedSchema = z.object({
  trip: z.object({
    name: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    timezone: z.string(),
    baseCurrency: z.string().length(3),
  }),
  days: z.array(z.object({ date: z.string(), title: z.string() })),
  places: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      address: z.string().optional(),
      neighbourhood: z.string().optional(),
      category: z.string().optional(),
      googleMapsUrl: z.string().url().optional(),
      priority: Priority,
      expectedDurationMinutes: z.number().int().positive().optional(),
    }),
  ),
  checklist: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      kind: z.enum(["PLACE", "FOOD", "EXPERIENCE", "SHOPPING", "OTHER"]),
      priority: Priority,
      plannedDay: z.string().optional(),
      dueDate: z.string().optional(),
      recommendedPlace: z.string().optional(),
      neighbourhood: z.string().optional(),
      placeKey: z.string().optional(),
      description: z.string().optional(),
      notes: z.string().optional(),
      dietaryWarning: z.string().optional(),
      syncTitles: z.array(z.string()).optional(),
    }),
  ),
  itinerary: z.array(
    z.object({
      date: z.string(),
      title: z.string(),
      type: z.enum([
        "attraction",
        "food",
        "transport",
        "activity",
        "booking",
        "shopping",
        "rest",
        "hotel",
        "other",
      ]),
      start: z.string().optional(),
      end: z.string().optional(),
      depart: z.string().optional(),
      durationMinutes: z.number().int().positive().optional(),
      priority: Priority,
      sequence: z.number().int(),
      placeKey: z.string().optional(),
      bookingKey: z.string().optional(),
      transportInstructions: z.string().optional(),
      estimatedCost: z.number().optional(),
      estimatedCostCurrency: z.string().optional(),
      estimatedCostScope: CostScope.optional(),
      estimatedCostStatus: CostStatus.optional(),
      timingType: TimingType.optional(),
      scheduleSensitive: z.boolean().optional(),
      details: ItineraryDetails.optional(),
      syncTitles: z.array(z.string()).optional(),
    }),
  ),
  accounts: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      accountClass: z.enum(["EXTERNAL_SOURCE", "STORED_VALUE"]),
      accountType: z.string(),
      currency: z.string().length(3),
      issuingBank: z.string().optional(),
      network: z.string().optional(),
      lastFour: z.string().length(4).optional(),
      billingCurrency: z.string().optional(),
      openingBalance: z.number().optional(),
    }),
  ),
  budgets: z.array(
    z.object({
      scope: z.enum(["TRIP", "CATEGORY", "DAILY"]),
      category: z.string().optional(),
      amount: z.number().positive(),
      currency: z.string().length(3),
      date: z.string().optional(),
    }),
  ),
  bookings: z.array(
    z.object({
      key: z.string(),
      type: z.string(),
      title: z.string(),
      provider: z.string().optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      status: z.string(),
      syncTitles: z.array(z.string()).optional(),
    }),
  ),
  importantNotes: z.array(z.object({ section: z.string(), title: z.string(), body: z.string(), summary: z.string().max(240).optional(), icon: z.string().max(16).optional(), copyText: z.string().optional(), pronunciation: z.string().max(300).optional(), meaning: z.string().max(300).optional(), sortOrder: z.number().int().optional() })),
});

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const seedPath = fileURLToPath(
  new URL("../seed/hong-kong-2026.json", import.meta.url),
);
const seed = SeedSchema.parse(JSON.parse(await readFile(seedPath, "utf8")));
const syncDateArg = process.argv.find((arg) => arg.startsWith("--sync-date="));
const syncDate = syncDateArg?.slice("--sync-date=".length);
const syncSourceOfTruth = process.argv.includes("--sync-source-of-truth");
const syncTripContent = process.argv.includes("--sync-trip-content") || syncSourceOfTruth;
if (syncDate && !seed.days.some((day) => day.date === syncDate)) {
  throw new Error(`No seed day exists for ${syncDate}`);
}
if (syncDate && syncSourceOfTruth) {
  throw new Error("--sync-date cannot be combined with --sync-source-of-truth");
}
for (const item of seed.itinerary) {
  if (item.estimatedCost !== undefined) {
    item.estimatedCostScope = "PARTY";
    item.estimatedCostStatus = item.priority === "OPTIONAL" ? "OPTIONAL" : "EXPECTED";
  }
}
const itemDetails = (item: (typeof seed.itinerary)[number]) => ({
  ...(item.details ?? {}),
  ...(item.timingType ? { timingType: item.timingType } : {}),
  ...(item.scheduleSensitive ? { scheduleSensitive: true } : {}),
  ...(item.estimatedCostScope ? { estimatedCostScope: item.estimatedCostScope } : {}),
  ...(item.estimatedCostStatus ? { estimatedCostStatus: item.estimatedCostStatus } : {}),
});

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function sameTimestamp(left?: string | null, right?: string) {
  if (!left || !right) return left === right;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isNaN(leftTime) || Number.isNaN(rightTime) ? left === right : leftTime === rightTime;
}

function validateItinerary() {
  const placeKeys = new Set(seed.places.map((place) => place.key));
  const bookingsByKey = new Map(seed.bookings.map((booking) => [booking.key, booking]));
  const dates = new Set(seed.days.map((day) => day.date));
  const errors: string[] = [];
  if (dates.size !== seed.days.length) errors.push("itinerary days contain duplicate dates");
  const itineraryKeys = new Set<string>();
  for (const item of seed.itinerary) {
    const itineraryKey = `${item.date}|${item.title}`;
    if (itineraryKeys.has(itineraryKey)) errors.push(`${item.date}: duplicate itinerary entry ${item.title}`);
    itineraryKeys.add(itineraryKey);
    if (!dates.has(item.date)) errors.push(`${item.title}: date ${item.date} has no itinerary day`);
    if (item.placeKey && !placeKeys.has(item.placeKey)) errors.push(`${item.title}: unknown place ${item.placeKey}`);
    const transportOptions = item.details?.transportOptions ?? [];
    if (transportOptions.length && !item.details?.recommended) errors.push(`${item.title}: transport options need a recommended option`);
    if (item.details?.recommended && !transportOptions.some((option) => option.name === item.details?.recommended)) errors.push(`${item.title}: recommended transport option does not match an option name`);
    if (item.estimatedCost !== undefined && (!item.estimatedCostCurrency || !item.estimatedCostScope || !item.estimatedCostStatus)) errors.push(`${item.title}: incomplete cost metadata`);
    const booking = item.bookingKey ? bookingsByKey.get(item.bookingKey) : undefined;
    if (item.bookingKey && !booking) errors.push(`${item.title}: unknown booking ${item.bookingKey}`);
    if (booking?.startsAt && booking.endsAt && item.durationMinutes !== undefined) {
      const elapsed = (Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000;
      if (elapsed !== item.durationMinutes) errors.push(`${item.title}: timezone-aware booking duration does not match`);
    } else if (item.start && item.end && item.durationMinutes && minutes(item.end) - minutes(item.start) !== item.durationMinutes) errors.push(`${item.title}: time arithmetic does not match duration`);
    if (item.start && item.end && item.start === item.end && item.durationMinutes) errors.push(`${item.title}: identical start/end with positive duration`);
  }
  for (const day of seed.days) {
    const items = seed.itinerary.filter((item) => item.date === day.date).sort((a, b) => a.sequence - b.sequence);
    for (let index = 1; index < items.length; index += 1) {
      if (items[index].sequence <= items[index - 1].sequence) errors.push(`${day.date}: sequence must increase`);
      const previous = items[index - 1]; const next = items[index];
      if (previous.end && next.start && minutes(next.start) < minutes(previous.end)) errors.push(`${day.date}: ${next.title} overlaps ${previous.title}`);
    }
  }
  for (const item of seed.checklist) {
    if (item.placeKey && !placeKeys.has(item.placeKey)) errors.push(`${item.title}: unknown checklist place ${item.placeKey}`);
    if (item.plannedDay && !dates.has(item.plannedDay)) errors.push(`${item.title}: planned day ${item.plannedDay} has no itinerary day`);
  }
  if (errors.length) throw new Error(`Seed itinerary validation failed:\n${errors.join("\n")}`);
}
validateItinerary();

if (process.argv.includes("--validate")) {
  console.log(`Validated ${seed.trip.name}: ${seed.days.length} days, ${seed.places.length} places, ${seed.itinerary.length} itinerary items.`);
  process.exit(0);
}

const url = required("SUPABASE_URL");
const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
const ownerEmail = required("TRIPBOARD_SEED_OWNER_EMAIL");
const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const users = await admin.auth.admin.listUsers({ perPage: 1000 });
if (users.error) throw users.error;
const owner = users.data.users.find(
  (user) => user.email?.toLowerCase() === ownerEmail.toLowerCase(),
);

if (!owner) {
  throw new Error(
    `No Supabase Auth user found for ${ownerEmail}. Sign in once before seeding.`,
  );
}

const displayName =
  typeof owner.user_metadata?.display_name === "string"
    ? owner.user_metadata.display_name
    : owner.email?.split("@")[0] ?? null;

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: owner.id,
    // `profiles.email` is required by the application schema. Auth users found
    // by email normally have this value, but use the requested owner email as
    // a defensive fallback rather than attempting a partial profile row.
    email: owner.email ?? ownerEmail,
    display_name: displayName,
  },
  {
    onConflict: "id",
  },
);

if (profileError) throw profileError;

// The seed represents one specific itinerary. Re-running it must be safe and
// must not create a second, indistinguishable trip.
const { data: existingTrip, error: existingTripError } = await admin
  .from("trips")
  .select("id, name")
  .eq("owner_id", owner.id)
  .eq("name", seed.trip.name)
  .eq("end_date", seed.trip.endDate)
  .maybeSingle();
if (existingTripError) throw existingTripError;

if (process.argv.includes("--verify-source-of-truth")) {
  if (!existingTrip) throw new Error("The seed trip does not exist yet");
  const [{ data: items, error: itemsError }, { data: checklist, error: checklistError }, { data: liveBookings, error: liveBookingsError }, { data: livePlaces, error: livePlacesError }] = await Promise.all([
    admin.from("itinerary_items").select("id,date,title,place_id,details").eq("trip_id", existingTrip.id),
    admin.from("checklist_items").select("title,planned_day").eq("trip_id", existingTrip.id),
    admin.from("bookings").select("title,starts_at").eq("trip_id", existingTrip.id),
    admin.from("places").select("id,name").eq("trip_id", existingTrip.id),
  ]);
  if (itemsError) throw itemsError;
  if (checklistError) throw checklistError;
  if (liveBookingsError) throw liveBookingsError;
  if (livePlacesError) throw livePlacesError;

  const errors: string[] = [];
  const sourceItemsByKey = new Map(seed.itinerary.map((item) => [`${item.date}|${item.title}`, item]));
  const liveItemsByKey = new Map<string, (typeof items extends (infer Row)[] | null ? Row : never)>();
  for (const item of items ?? []) {
    const key = `${item.date}|${item.title}`;
    if (liveItemsByKey.has(key)) errors.push(`duplicate live itinerary entry: ${key}`);
    liveItemsByKey.set(key, item);
    if (!sourceItemsByKey.has(key)) errors.push(`stale live itinerary entry: ${key}`);
    const details = item.details && typeof item.details === "object" && !Array.isArray(item.details) ? item.details as Record<string, unknown> : undefined;
    if (details?.recommended) {
      const options = Array.isArray(details.transportOptions) ? details.transportOptions : [];
      if (!options.some((option) => option && typeof option === "object" && !Array.isArray(option) && (option as Record<string, unknown>).name === details.recommended)) errors.push(`invalid live transport recommendation: ${key}`);
    }
  }
  for (const [key, sourceItem] of sourceItemsByKey) {
    const liveItem = liveItemsByKey.get(key);
    if (!liveItem) { errors.push(`missing live itinerary entry: ${key}`); continue; }
    if (sourceItem.placeKey) {
      const expectedPlace = seed.places.find((place) => place.key === sourceItem.placeKey)?.name;
      const actualPlace = (livePlaces ?? []).find((place) => place.id === liveItem.place_id)?.name;
      if (expectedPlace !== actualPlace) errors.push(`broken live place reference: ${key}`);
    }
  }
  const liveChecklistByTitle = new Map((checklist ?? []).map((item) => [item.title, item]));
  const sourceChecklistTitles = new Set(seed.checklist.map((item) => item.title));
  const unmanagedChecklist = (checklist ?? []).filter((item) => !sourceChecklistTitles.has(item.title)).map((item) => item.title);
  for (const item of seed.checklist) {
    const liveItem = liveChecklistByTitle.get(item.title);
    if (!liveItem) errors.push(`missing live checklist item: ${item.title}`);
    else if ((liveItem.planned_day ?? undefined) !== item.plannedDay) errors.push(`stale checklist day: ${item.title}`);
  }
  const liveBookingsByTitle = new Map((liveBookings ?? []).map((booking) => [booking.title, booking]));
  const sourceBookingTitles = new Set(seed.bookings.map((booking) => booking.title));
  const unmanagedBookings = (liveBookings ?? []).filter((booking) => !sourceBookingTitles.has(booking.title)).map((booking) => booking.title);
  for (const booking of seed.bookings) {
    const liveBooking = liveBookingsByTitle.get(booking.title);
    if (!liveBooking) errors.push(`missing live booking: ${booking.title}`);
    else if (!sameTimestamp(liveBooking.starts_at, booking.startsAt)) errors.push(`stale booking time: ${booking.title}`);
  }
  const report = { tripId: existingTrip.id, sourceItems: seed.itinerary.length, liveItems: items?.length ?? 0, sourceChecklist: seed.checklist.length, liveChecklist: checklist?.length ?? 0, sourceBookings: seed.bookings.length, liveBookings: liveBookings?.length ?? 0, unmanagedChecklist, unmanagedBookings, errors };
  console.log(JSON.stringify(report, null, 2));
  process.exit(errors.length ? 1 : 0);
}

if (existingTrip && (process.argv.includes("--sync-itinerary") || syncTripContent || process.argv.includes("--sync-transport-details"))) {
  // This is deliberately opt-in: it makes the itinerary on the existing seed
  // trip match the JSON file while preserving financial records and traveller
  // progress. New seed days and bookings are added before item linking.
  const [{ data: days, error: daysError }, { data: places, error: placesError }, { data: bookings, error: bookingsError }] = await Promise.all([
    admin.from("itinerary_days").select("id, date").eq("trip_id", existingTrip.id),
    admin.from("places").select("id, name").eq("trip_id", existingTrip.id),
    admin.from("bookings").select("id, title").eq("trip_id", existingTrip.id),
  ]);
  if (daysError) throw daysError;
  if (placesError) throw placesError;
  if (bookingsError) throw bookingsError;

  const missingDays = seed.days.filter((day) => !(days ?? []).some((row) => row.date === day.date));
  const { error: insertedDaysError } = missingDays.length ? await admin.from("itinerary_days").upsert(missingDays.map((day) => ({ trip_id: existingTrip.id, ...day })), { onConflict: "trip_id,date", ignoreDuplicates: true }) : { error: null };
  if (insertedDaysError) throw insertedDaysError;
  const { data: allDays, error: allDaysError } = await admin.from("itinerary_days").select("id,date").eq("trip_id", existingTrip.id);
  if (allDaysError) throw allDaysError;

  const bookingsByTitle = new Map((bookings ?? []).map((booking) => [booking.title, booking.id]));
  const bookingIds = new Map<string, string>();
  for (const booking of seed.bookings) {
    const id = [booking.title, ...(booking.syncTitles ?? [])].map((title) => bookingsByTitle.get(title)).find(Boolean);
    const payload = { trip_id: existingTrip.id, type: booking.type, title: booking.title, provider: booking.provider, starts_at: booking.startsAt, ends_at: booking.endsAt, amount: booking.amount, currency: booking.currency, status: booking.status, updated_by: owner.id };
    if (id) {
      const { error } = await admin.from("bookings").update(payload).eq("id", id);
      if (error) throw error;
      bookingIds.set(booking.key, id);
    } else {
      const { data, error } = await admin.from("bookings").insert({ ...payload, created_by: owner.id }).select("id").single();
      if (error) throw error;
      bookingIds.set(booking.key, data.id);
    }
  }

  const { error: tripDateError } = await admin.from("trips").update({ start_date: seed.trip.startDate }).eq("id", existingTrip.id);
  if (tripDateError) throw tripDateError;

  const missingPlaces = seed.places.filter((place) => !(places ?? []).some((row) => row.name === place.name));
  const { data: insertedPlaces, error: insertedPlacesError } = missingPlaces.length ? await admin.from("places").insert(missingPlaces.map((place) => ({ trip_id: existingTrip.id, name: place.name, address: place.address, neighbourhood: place.neighbourhood, category: place.category, google_maps_url: place.googleMapsUrl, priority: place.priority, expected_duration_minutes: place.expectedDurationMinutes }))).select("id,name") : { data: [], error: null };
  if (insertedPlacesError) throw insertedPlacesError;
  const allPlaces = [...(places ?? []), ...(insertedPlaces ?? [])];

  const dayIds = new Map((allDays ?? []).map((day) => [day.date, day.id]));
  const placeIds = new Map(
    seed.places.map((place) => [
      place.key,
      allPlaces.find((row) => row.name === place.name)?.id,
    ]),
  );
  for (const item of seed.itinerary) {
    if (!dayIds.has(item.date)) throw new Error(`No itinerary day exists for ${item.date}`);
    if (item.placeKey && !placeIds.get(item.placeKey)) throw new Error(`No seeded place exists for ${item.placeKey}`);
    if (item.bookingKey && !bookingIds.get(item.bookingKey)) throw new Error(`No seeded booking exists for ${item.bookingKey}`);
  }

  if (process.argv.includes("--sync-transport-details")) {
    // Keep the existing itinerary schedule and traveller-created records intact.
    // This updates only structured transport data from the current seed JSON.
    const { data: existingItems, error: existingItemsError } = await admin.from("itinerary_items").select("id,date,title").eq("trip_id", existingTrip.id);
    if (existingItemsError) throw existingItemsError;
    const existingByDateAndTitle = new Map((existingItems ?? []).map((item) => [`${item.date}|${item.title}`, item.id]));
    const existingByTitle = new Map((existingItems ?? []).map((item) => [item.title, item.id]));
    const transportItems = seed.itinerary.filter((item) => item.details?.transportOptions?.length);
    for (const item of transportItems) {
      const id = [item.title, ...(item.syncTitles ?? [])].map((title) => existingByDateAndTitle.get(`${item.date}|${title}`) ?? existingByTitle.get(title)).find(Boolean);
      if (!id) throw new Error(`No existing itinerary entry found for transport details: ${item.title}`);
      const { error: updateError } = await admin.from("itinerary_items").update({ details: itemDetails(item), updated_by: owner.id }).eq("id", id);
      if (updateError) throw updateError;
    }
    console.log(`Safely synced transport details for ${transportItems.length} itinerary entries to ${existingTrip.name} (${existingTrip.id}).`);
    process.exit(0);
  }

  // Content sync updates seed-owned entries that can be identified by
  // date/title and preserves their IDs. Unmatched personal bookings and
  // checklist items are deliberately left alone.
  if (syncTripContent) {
    const itineraryToSync = syncDate ? seed.itinerary.filter((item) => item.date === syncDate) : seed.itinerary;
    const daysToSync = syncDate ? seed.days.filter((day) => day.date === syncDate) : seed.days;
    const { data: existingItems, error: existingItemsError } = await admin.from("itinerary_items").select("id,date,title").eq("trip_id", existingTrip.id);
    if (existingItemsError) throw existingItemsError;
    const existingByDateAndTitle = new Map((existingItems ?? []).map((item) => [`${item.date}|${item.title}`, item.id]));
    const existingByTitle = new Map((existingItems ?? []).map((item) => [item.title, item.id]));
    const itemPayload = (item: (typeof seed.itinerary)[number]) => ({
      trip_id: existingTrip.id, itinerary_day_id: dayIds.get(item.date), date: item.date, title: item.title, item_type: item.type,
      planned_start_time: item.start, planned_end_time: item.end, recommended_departure_time: item.depart,
      expected_duration_minutes: item.durationMinutes, priority: item.priority, sequence: item.sequence,
      place_id: item.placeKey ? placeIds.get(item.placeKey) : null, booking_id: item.bookingKey ? bookingIds.get(item.bookingKey) : null,
      transport_instructions: item.transportInstructions, estimated_cost: item.estimatedCost, estimated_cost_currency: item.estimatedCostCurrency,
      details: itemDetails(item), updated_by: owner.id,
    });
    const syncedItemIds = new Set<string>();
    for (const item of itineraryToSync) {
      const id = [item.title, ...(item.syncTitles ?? [])].map((title) => existingByDateAndTitle.get(`${item.date}|${title}`) ?? existingByTitle.get(title)).find(Boolean);
      if (id) {
        const { error } = await admin.from("itinerary_items").update(itemPayload(item)).eq("id", id);
        if (error) throw error;
        syncedItemIds.add(id);
      } else {
        const { data, error } = await admin.from("itinerary_items").insert({ ...itemPayload(item), created_by: owner.id }).select("id").single();
        if (error) throw error;
        syncedItemIds.add(data.id);
      }
    }
    for (const day of daysToSync) {
      const id = dayIds.get(day.date);
      if (id) { const { error: dayError } = await admin.from("itinerary_days").update({ title: day.title }).eq("id", id); if (dayError) throw dayError; }
    }
    if (syncDate) {
      console.log(`Safely synced ${itineraryToSync.length} itinerary entries for ${syncDate} to ${existingTrip.name} (${existingTrip.id}).`);
      process.exit(0);
    }
    if (syncSourceOfTruth) {
      const staleItemIds = (existingItems ?? []).filter((item) => !syncedItemIds.has(item.id)).map((item) => item.id);
      if (staleItemIds.length) {
        const { error } = await admin.from("itinerary_items").delete().in("id", staleItemIds);
        if (error) throw error;
      }
    }
    const { data: existingChecklist, error: existingChecklistError } = await admin.from("checklist_items").select("id,title").eq("trip_id", existingTrip.id);
    if (existingChecklistError) throw existingChecklistError;
    const checklistByTitle = new Map((existingChecklist ?? []).map((item) => [item.title, item.id]));
    let insertedChecklistCount = 0;
    for (const item of seed.checklist) {
      const id = [item.title, ...(item.syncTitles ?? [])].map((title) => checklistByTitle.get(title)).find(Boolean);
      const payload = { trip_id: existingTrip.id, title: item.title, description: item.description, notes: item.notes, dietary_warning: item.dietaryWarning, kind: item.kind, priority: item.priority, planned_day: item.plannedDay, due_date: item.dueDate, recommended_place: item.recommendedPlace, neighbourhood: item.neighbourhood, updated_by: owner.id };
      if (id) {
        const { error } = await admin.from("checklist_items").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("checklist_items").insert({ ...payload, created_by: owner.id });
        if (error) throw error;
        insertedChecklistCount += 1;
      }
    }
    const { data: existingNotes, error: existingNotesError } = await admin.from("trip_notes").select("id,title").eq("trip_id", existingTrip.id);
    if (existingNotesError) throw existingNotesError;
    const notesByTitle = new Map((existingNotes ?? []).map((note) => [note.title, note.id]));
    const noteTitles = new Set(notesByTitle.keys());
    const noteAdditions = seed.importantNotes.filter((note) => !noteTitles.has(note.title));
    if (noteAdditions.length) {
      const { error: notesError } = await admin.from("trip_notes").insert(noteAdditions.map((note, index) => ({ trip_id: existingTrip.id, section: note.section, title: note.title, body: note.body, summary: note.summary, icon: note.icon, copy_text: note.copyText, pronunciation: note.pronunciation, meaning: note.meaning, sort_order: note.sortOrder ?? index, created_by: owner.id, updated_by: owner.id })));
      if (notesError) throw notesError;
    }
    for (const [index, note] of seed.importantNotes.entries()) {
      const id = notesByTitle.get(note.title); if (!id) continue;
      const { error: noteUpdateError } = await admin.from("trip_notes").update({ section: note.section, body: note.body, summary: note.summary, icon: note.icon, copy_text: note.copyText, pronunciation: note.pronunciation, meaning: note.meaning, sort_order: note.sortOrder ?? index, updated_by: owner.id }).eq("id", id);
      if (noteUpdateError) throw noteUpdateError;
    }
    console.log(`${syncSourceOfTruth ? "Source-of-truth" : "Safe"} sync completed: ${seed.itinerary.length} itinerary entries, ${insertedChecklistCount} new checklist items, and ${noteAdditions.length} important notes to ${existingTrip.name} (${existingTrip.id}).`);
    process.exit(0);
  }

  const { error: deleteError } = await admin
    .from("itinerary_items")
    .delete()
    .eq("trip_id", existingTrip.id);
  if (deleteError) throw deleteError;

  const { error: insertError } = await admin.from("itinerary_items").insert(
    seed.itinerary.map((item) => ({
      trip_id: existingTrip.id,
      itinerary_day_id: dayIds.get(item.date),
      date: item.date,
      title: item.title,
      item_type: item.type,
      planned_start_time: item.start,
      planned_end_time: item.end,
      recommended_departure_time: item.depart,
      expected_duration_minutes: item.durationMinutes,
      priority: item.priority,
      sequence: item.sequence,
      place_id: item.placeKey ? placeIds.get(item.placeKey) : null,
      booking_id: item.bookingKey ? bookingIds.get(item.bookingKey) : null,
      transport_instructions: item.transportInstructions,
      details: itemDetails(item),
      estimated_cost: item.estimatedCost,
      estimated_cost_currency: item.estimatedCostCurrency,
      created_by: owner.id,
      updated_by: owner.id,
    })),
  );
  if (insertError) throw insertError;
  console.log(`Synced ${seed.itinerary.length} itinerary items to ${existingTrip.name} (${existingTrip.id}).`);
  process.exit(0);
}

if (existingTrip) {
  console.log(`Seed already exists: ${existingTrip.name} (${existingTrip.id}). No changes made.`);
  process.exit(0);
}

const { data: trip, error: tripError } = await admin
  .from("trips")
  .insert({
    name: seed.trip.name,
    start_date: seed.trip.startDate,
    end_date: seed.trip.endDate,
    timezone: seed.trip.timezone,
    base_currency: seed.trip.baseCurrency,
    owner_id: owner.id,
  })
  .select()
  .single();
if (tripError) throw tripError;

const { data: days, error: dayError } = await admin
  .from("itinerary_days")
  .insert(
    seed.days.map((day) => ({
      trip_id: trip.id,
      date: day.date,
      title: day.title,
    })),
  )
  .select();
if (dayError) throw dayError;
const dayIds = new Map(days.map((day) => [day.date, day.id]));

const { data: places, error: placeError } = await admin
  .from("places")
  .insert(
    seed.places.map((place) => ({
      trip_id: trip.id,
      name: place.name,
      address: place.address,
      neighbourhood: place.neighbourhood,
      category: place.category,
      google_maps_url: place.googleMapsUrl,
      priority: place.priority,
      expected_duration_minutes: place.expectedDurationMinutes,
    })),
  )
  .select();
if (placeError) throw placeError;
const placeIds = new Map(
  seed.places.map((place, index) => [place.key, places[index].id]),
);

const { data: bookings, error: bookingError } = await admin
  .from("bookings")
  .insert(
    seed.bookings.map((booking) => ({
      trip_id: trip.id,
      type: booking.type,
      title: booking.title,
      provider: booking.provider,
      starts_at: booking.startsAt,
      ends_at: booking.endsAt,
      amount: booking.amount,
      currency: booking.currency,
      status: booking.status,
      created_by: owner.id,
      updated_by: owner.id,
    })),
  )
  .select();
if (bookingError) throw bookingError;
const bookingIds = new Map(
  seed.bookings.map((booking, index) => [booking.key, bookings[index].id]),
);

const { error: checklistError } = await admin
  .from("checklist_items")
  .insert(
    seed.checklist.map((item) => ({
      trip_id: trip.id,
      title: item.title,
      description: item.description,
      notes: item.notes,
      dietary_warning: item.dietaryWarning,
      kind: item.kind,
      priority: item.priority,
      planned_day: item.plannedDay,
      due_date: item.dueDate,
      recommended_place: item.recommendedPlace,
      neighbourhood: item.neighbourhood,
      linked_place_id: item.placeKey ? placeIds.get(item.placeKey) : null,
      created_by: owner.id,
      updated_by: owner.id,
    })),
  );
if (checklistError) throw checklistError;

const { error: noteError } = await admin.from("trip_notes").insert(seed.importantNotes.map((note, index) => ({ trip_id: trip.id, section: note.section, title: note.title, body: note.body, summary: note.summary, icon: note.icon, copy_text: note.copyText, pronunciation: note.pronunciation, meaning: note.meaning, sort_order: note.sortOrder ?? index, created_by: owner.id, updated_by: owner.id })));
if (noteError) throw noteError;

const { error: itineraryError } = await admin
  .from("itinerary_items")
  .insert(
    seed.itinerary.map((item) => ({
      trip_id: trip.id,
      itinerary_day_id: dayIds.get(item.date),
      date: item.date,
      title: item.title,
      item_type: item.type,
      planned_start_time: item.start,
      planned_end_time: item.end,
      recommended_departure_time: item.depart,
      expected_duration_minutes: item.durationMinutes,
      priority: item.priority,
      sequence: item.sequence,
      place_id: item.placeKey ? placeIds.get(item.placeKey) : null,
      booking_id: item.bookingKey ? bookingIds.get(item.bookingKey) : null,
      transport_instructions: item.transportInstructions,
      details: itemDetails(item),
      estimated_cost: item.estimatedCost,
      estimated_cost_currency: item.estimatedCostCurrency,
      created_by: owner.id,
      updated_by: owner.id,
    })),
  );
if (itineraryError) throw itineraryError;

const { error: accountError } = await admin
  .from("payment_accounts")
  .insert(
    seed.accounts.map((account) => ({
      trip_id: trip.id,
      name: account.name,
      account_class: account.accountClass,
      account_type: account.accountType,
      currency: account.currency,
      issuing_bank: account.issuingBank,
      network: account.network,
      last_four: account.lastFour,
      billing_currency: account.billingCurrency,
      opening_balance: account.openingBalance ?? 0,
    })),
  );
if (accountError) throw accountError;

const { error: budgetError } = await admin
  .from("budgets")
  .insert(
    seed.budgets.map((budget) => ({
      trip_id: trip.id,
      budget_scope: budget.scope,
      category: budget.category,
      amount: budget.amount,
      currency: budget.currency,
      date: budget.date,
    })),
  );
if (budgetError) throw budgetError;

console.log(`Seeded ${trip.name} (${trip.id}) for ${ownerEmail}`);
