import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Priority = z.enum(["MUST", "WANT", "OPTIONAL"]);
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
      recommendedPlace: z.string().optional(),
      neighbourhood: z.string().optional(),
      placeKey: z.string().optional(),
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
      amount: z.number().optional(),
      currency: z.string().optional(),
      status: z.string(),
    }),
  ),
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
  .eq("start_date", seed.trip.startDate)
  .eq("end_date", seed.trip.endDate)
  .maybeSingle();
if (existingTripError) throw existingTripError;

if (existingTrip && process.argv.includes("--sync-itinerary")) {
  // This is deliberately opt-in: it makes the itinerary on the existing seed
  // trip match the JSON file, while leaving checklist, places, bookings,
  // accounts, budgets, and financial records untouched.
  const [{ data: days, error: daysError }, { data: places, error: placesError }, { data: bookings, error: bookingsError }] = await Promise.all([
    admin.from("itinerary_days").select("id, date").eq("trip_id", existingTrip.id),
    admin.from("places").select("id, name").eq("trip_id", existingTrip.id),
    admin.from("bookings").select("id, title").eq("trip_id", existingTrip.id),
  ]);
  if (daysError) throw daysError;
  if (placesError) throw placesError;
  if (bookingsError) throw bookingsError;

  const dayIds = new Map((days ?? []).map((day) => [day.date, day.id]));
  const placeIds = new Map(
    seed.places.map((place) => [
      place.key,
      (places ?? []).find((row) => row.name === place.name)?.id,
    ]),
  );
  const bookingIds = new Map(
    seed.bookings.map((booking) => [
      booking.key,
      (bookings ?? []).find((row) => row.title === booking.title)?.id,
    ]),
  );

  for (const item of seed.itinerary) {
    if (!dayIds.has(item.date)) throw new Error(`No itinerary day exists for ${item.date}`);
    if (item.placeKey && !placeIds.get(item.placeKey)) throw new Error(`No seeded place exists for ${item.placeKey}`);
    if (item.bookingKey && !bookingIds.get(item.bookingKey)) throw new Error(`No seeded booking exists for ${item.bookingKey}`);
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
      kind: item.kind,
      priority: item.priority,
      planned_day: item.plannedDay,
      recommended_place: item.recommendedPlace,
      neighbourhood: item.neighbourhood,
      linked_place_id: item.placeKey ? placeIds.get(item.placeKey) : null,
      created_by: owner.id,
      updated_by: owner.id,
    })),
  );
if (checklistError) throw checklistError;

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
