"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChecklistItem, ItineraryItem, ItineraryStatus, Trip } from "../../types/domain";
import type { FinancialEvent, PaymentAccount } from "../money/domain";
import { enqueueMutation, replayQueue } from "../../lib/offline/queue";
import { offlineDb, type CachedTripRecord } from "../../lib/offline/db";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { demoAccounts, demoBookings, demoChecklist, demoFinancialEvents, demoItinerary, demoPlaces, demoTrip, type DemoBooking, type DemoPlace } from "./demo-data";

export interface TripBoardData {
  trip: Trip;
  itinerary: ItineraryItem[];
  checklist: ChecklistItem[];
  bookings: DemoBooking[];
  places: DemoPlace[];
  accounts: PaymentAccount[];
  financialEvents: FinancialEvent[];
  loading: boolean;
  authRequired: boolean;
  demoMode: boolean;
  dataAvailable: boolean;
  error?: string;
  completeItinerary: (id: string) => Promise<void>;
  skipItinerary: (id: string) => Promise<void>;
  moveItinerary: (id: string, date: string, time?: string) => Promise<void>;
  addItineraryItem: (item: EditableItineraryItem) => Promise<void>;
  editItineraryItem: (id: string, item: EditableItineraryItem) => Promise<void>;
  deleteItineraryItem: (id: string) => Promise<void>;
  toggleChecklist: (id: string) => Promise<void>;
  addChecklistItem: (item: Pick<ChecklistItem, "title" | "kind" | "priority"> & { plannedDay?: string }) => Promise<void>;
  recordFinancialEvent: (event: FinancialEvent) => Promise<void>;
  refresh: () => Promise<void>;
}

export type EditableItineraryItem = Pick<ItineraryItem, "date" | "title" | "type" | "plannedStartTime" | "plannedEndTime" | "expectedDurationMinutes" | "priority" | "description" | "transportInstructions">;

type TripSnapshot = Pick<TripBoardData, "trip" | "itinerary" | "checklist" | "bookings" | "places" | "accounts" | "financialEvents">;

const emptyTrip: Trip = {
  id: "",
  name: "Your shared trip",
  startDate: "",
  endDate: "",
  timezone: "UTC",
  baseCurrency: "USD",
};

const cacheKeyForUser = (userId: string) => `remote-trip:${userId}`;

function applySnapshot(snapshot: TripSnapshot, setters: {
  setTrip: (value: Trip) => void;
  setItinerary: (value: ItineraryItem[]) => void;
  setChecklist: (value: ChecklistItem[]) => void;
  setBookings: (value: DemoBooking[]) => void;
  setPlaces: (value: DemoPlace[]) => void;
  setAccounts: (value: PaymentAccount[]) => void;
  setFinancialEvents: (value: FinancialEvent[]) => void;
}) {
  setters.setTrip(snapshot.trip);
  setters.setItinerary(snapshot.itinerary);
  setters.setChecklist(snapshot.checklist);
  setters.setBookings(snapshot.bookings);
  setters.setPlaces(snapshot.places);
  setters.setAccounts(snapshot.accounts);
  setters.setFinancialEvents(snapshot.financialEvents);
}

const mapItinerary = (row: Record<string, unknown>): ItineraryItem => ({
  id: String(row.id), tripId: String(row.trip_id), date: String(row.date), title: String(row.title), description: row.description ? String(row.description) : undefined,
  type: row.item_type as ItineraryItem["type"], plannedStartTime: row.planned_start_time ? String(row.planned_start_time).slice(0, 5) : undefined,
  plannedEndTime: row.planned_end_time ? String(row.planned_end_time).slice(0, 5) : undefined, expectedDurationMinutes: row.expected_duration_minutes ? Number(row.expected_duration_minutes) : undefined,
  recommendedDepartureTime: row.recommended_departure_time ? String(row.recommended_departure_time).slice(0, 5) : undefined, priority: row.priority as ItineraryItem["priority"],
  status: row.status as ItineraryStatus, sequence: Number(row.sequence), completedAt: row.completed_at ? String(row.completed_at) : undefined,
  bookingId: row.booking_id ? String(row.booking_id) : undefined, mapsUrl: row.maps_url ? String(row.maps_url) : undefined, transportInstructions: row.transport_instructions ? String(row.transport_instructions) : undefined,
});

const mapChecklist = (row: Record<string, unknown>): ChecklistItem => ({
  id: String(row.id), tripId: String(row.trip_id), title: String(row.title), description: row.description ? String(row.description) : undefined,
  kind: row.kind as ChecklistItem["kind"], priority: row.priority as ChecklistItem["priority"], targetCount: Number(row.target_count), completedCount: Number(row.completed_count),
  plannedDay: row.planned_day ? String(row.planned_day) : undefined, status: row.status as ChecklistItem["status"], neighbourhood: row.neighbourhood ? String(row.neighbourhood) : undefined,
  dietaryWarning: row.dietary_warning ? String(row.dietary_warning) : undefined, rating: row.rating ? Number(row.rating) : undefined, favourite: Boolean(row.favourite),
});

export function useTripBoardData(): TripBoardData {
  // All initial values are deliberately independent of runtime environment so
  // SSR and the browser's hydration pass render the same loading screen.
  const [trip, setTrip] = useState<Trip>(emptyTrip);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [bookings, setBookings] = useState<DemoBooking[]>([]);
  const [places, setPlaces] = useState<DemoPlace[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [financialEvents, setFinancialEvents] = useState<FinancialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [dataAvailable, setDataAvailable] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      // Demo content is only ever shown when Supabase was intentionally left
      // unconfigured, never as a fallback for a failed remote request.
      applySnapshot({ trip: demoTrip, itinerary: demoItinerary, checklist: demoChecklist, bookings: demoBookings, places: demoPlaces, accounts: demoAccounts, financialEvents: demoFinancialEvents }, { setTrip, setItinerary, setChecklist, setBookings, setPlaces, setAccounts, setFinancialEvents });
      setDemoMode(true);
      setDataAvailable(true);
      setError(undefined);
      setLoading(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setAuthRequired(true); setLoading(false); return; }
    setAuthRequired(false);
    setDemoMode(false);
    const cacheKey = cacheKeyForUser(sessionData.session.user.id);
    const loadCachedSnapshot = async (message: string) => {
      // IndexedDB can be unavailable in private browsing or when storage is
      // disabled. That should still lead to an honest no-data state.
      const record = await offlineDb.cache.get(cacheKey).catch(() => undefined);
      const snapshot = record?.value as TripSnapshot | undefined;
      if (snapshot?.trip?.id) {
        applySnapshot(snapshot, { setTrip, setItinerary, setChecklist, setBookings, setPlaces, setAccounts, setFinancialEvents });
        setDataAvailable(true);
        setError(`${message} Showing the copy saved on this device.`);
      } else {
        setDataAvailable(false);
        setError(message);
      }
      setLoading(false);
    };
    const { data: tripRow, error: tripError } = await supabase.from("trips").select("*").is("archived_at", null).order("start_date", { ascending: false }).limit(1).maybeSingle();
    if (tripError) { await loadCachedSnapshot("We couldn’t load the shared trip."); return; }
    if (!tripRow) { setDataAvailable(false); setError("No trip has been shared with this account yet."); setLoading(false); return; }
    const nextTrip: Trip = { id: tripRow.id, name: tripRow.name, startDate: tripRow.start_date, endDate: tripRow.end_date, timezone: tripRow.timezone, baseCurrency: tripRow.base_currency };
    const [itemsResult, checklistResult, bookingResult, placeResult, accountResult, financialResult] = await Promise.all([
      supabase.from("itinerary_items").select("*").eq("trip_id", tripRow.id).order("date").order("sequence"),
      supabase.from("checklist_items").select("*").eq("trip_id", tripRow.id).order("priority"),
      supabase.from("bookings").select("*, booking_files(filename, mime_type, storage_path)").eq("trip_id", tripRow.id).order("starts_at"),
      supabase.from("places").select("*").eq("trip_id", tripRow.id).order("name"),
      supabase.from("payment_accounts").select("*").eq("trip_id", tripRow.id).is("archived_at", null).order("account_class"),
      supabase.from("financial_transactions").select("*").eq("trip_id", tripRow.id).is("voided_at", null).order("occurred_at"),
    ]);
    if (itemsResult.error || checklistResult.error || bookingResult.error || placeResult.error || accountResult.error || financialResult.error) { await loadCachedSnapshot("Some trip data could not be refreshed. Try again when your connection improves."); return; }
    setTrip(nextTrip);
    setItinerary((itemsResult.data ?? []).map((row) => mapItinerary(row as Record<string, unknown>)));
    setChecklist((checklistResult.data ?? []).map((row) => mapChecklist(row as Record<string, unknown>)));
    setBookings((bookingResult.data ?? []).map((row) => ({ id: row.id, title: row.title, type: row.type, provider: row.provider ?? "", reference: row.booking_reference ?? "", startsAt: row.starts_at ?? "", status: row.status, files: (row.booking_files ?? []).map((file: { filename: string; mime_type: string; storage_path: string }) => ({ name: file.filename, kind: file.mime_type === "application/pdf" ? "PDF" : "Image", path: file.storage_path })) })));
    setPlaces((placeResult.data ?? []).map((row) => ({ id: row.id, name: row.name, neighbourhood: row.neighbourhood ?? "", category: row.category ?? "Place", address: row.address ?? "", mapsUrl: row.google_maps_url ?? undefined, priority: row.priority })));
    setAccounts((accountResult.data ?? []).map((row) => ({ id: row.id, name: row.name, accountClass: row.account_class, currency: row.currency, openingBalance: String(row.opening_balance) })));
    setFinancialEvents((financialResult.data ?? []).map((row) => ({ id: row.id, idempotencyKey: row.idempotency_key, type: row.transaction_type, occurredAt: row.occurred_at, description: row.description, category: row.category ?? undefined, sourceAccountId: row.source_account_id ?? undefined, destinationAccountId: row.destination_account_id ?? undefined, sourceAmount: row.source_amount ? String(row.source_amount) : undefined, sourceCurrency: row.source_currency ?? undefined, destinationAmount: row.destination_amount ? String(row.destination_amount) : undefined, destinationCurrency: row.destination_currency ?? undefined, consumptionAmount: row.consumption_amount ? String(row.consumption_amount) : undefined, consumptionCurrency: row.consumption_currency ?? undefined, estimatedInrAmount: row.estimated_inr_amount ? String(row.estimated_inr_amount) : undefined, settledInrAmount: row.settled_inr_amount ? String(row.settled_inr_amount) : undefined, settlementStatus: row.settlement_status ?? undefined, originalTransactionId: row.original_transaction_id ?? undefined })));
    const snapshot: TripSnapshot = {
      trip: nextTrip,
      itinerary: (itemsResult.data ?? []).map((row) => mapItinerary(row as Record<string, unknown>)),
      checklist: (checklistResult.data ?? []).map((row) => mapChecklist(row as Record<string, unknown>)),
      bookings: (bookingResult.data ?? []).map((row) => ({ id: row.id, title: row.title, type: row.type, provider: row.provider ?? "", reference: row.booking_reference ?? "", startsAt: row.starts_at ?? "", status: row.status, files: (row.booking_files ?? []).map((file: { filename: string; mime_type: string; storage_path: string }) => ({ name: file.filename, kind: file.mime_type === "application/pdf" ? "PDF" : "Image", path: file.storage_path })) })),
      places: (placeResult.data ?? []).map((row) => ({ id: row.id, name: row.name, neighbourhood: row.neighbourhood ?? "", category: row.category ?? "Place", address: row.address ?? "", mapsUrl: row.google_maps_url ?? undefined, priority: row.priority })),
      accounts: (accountResult.data ?? []).map((row) => ({ id: row.id, name: row.name, accountClass: row.account_class, currency: row.currency, openingBalance: String(row.opening_balance) })),
      financialEvents: (financialResult.data ?? []).map((row) => ({ id: row.id, idempotencyKey: row.idempotency_key, type: row.transaction_type, occurredAt: row.occurred_at, description: row.description, category: row.category ?? undefined, sourceAccountId: row.source_account_id ?? undefined, destinationAccountId: row.destination_account_id ?? undefined, sourceAmount: row.source_amount ? String(row.source_amount) : undefined, sourceCurrency: row.source_currency ?? undefined, destinationAmount: row.destination_amount ? String(row.destination_amount) : undefined, destinationCurrency: row.destination_currency ?? undefined, consumptionAmount: row.consumption_amount ? String(row.consumption_amount) : undefined, consumptionCurrency: row.consumption_currency ?? undefined, estimatedInrAmount: row.estimated_inr_amount ? String(row.estimated_inr_amount) : undefined, settledInrAmount: row.settled_inr_amount ? String(row.settled_inr_amount) : undefined, settlementStatus: row.settlement_status ?? undefined, originalTransactionId: row.original_transaction_id ?? undefined })),
    };
    void offlineDb.cache.put({ key: cacheKey, tripId: nextTrip.id, kind: "remote-trip", value: snapshot, updatedAt: new Date().toISOString() } satisfies CachedTripRecord).catch(() => undefined);
    setDataAvailable(true);
    setError(undefined);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || trip.id === demoTrip.id) return;
    const channel = supabase.channel(`trip:${trip.id}`);
    for (const table of ["itinerary_items", "checklist_items", "bookings", "financial_transactions"] as const) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `trip_id=eq.${trip.id}` }, () => { void refresh(); });
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, trip.id]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const sync = () => { void replayQueue(async (mutation) => {
      if (mutation.entity === "itinerary") {
        const { error: syncError } = mutation.command === "create"
          ? await supabase.from("itinerary_items").insert(mutation.payload)
          : mutation.command === "delete"
            ? await supabase.from("itinerary_items").delete().eq("id", mutation.payload.id)
            : await supabase.from("itinerary_items").update(mutation.payload).eq("id", mutation.payload.id);
        if (syncError) throw syncError;
      } else if (mutation.entity === "checklist") {
        const { error: syncError } = mutation.command === "create"
          ? await supabase.from("checklist_items").insert(mutation.payload)
          : await supabase.from("checklist_items").update(mutation.payload).eq("id", mutation.payload.id);
        if (syncError) throw syncError;
      } else if (mutation.entity === "financial") await sendFinancialRpc(supabase, mutation.payload.event as FinancialEvent, mutation.tripId);
    }).then(refresh); };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("focus", sync); };
  }, [refresh]);

  const updateItinerary = async (id: string, patch: Partial<ItineraryItem>, databasePatch: Record<string, unknown>) => {
    setItinerary((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload: { id, ...databasePatch } }); return; }
    const { error: updateError } = await supabase.from("itinerary_items").update(databasePatch).eq("id", id);
    if (updateError) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload: { id, ...databasePatch } }); setError("This change is saved on this device and waiting to sync."); }
  };

  const setStatus = (id: string, status: ItineraryStatus) => updateItinerary(id, { status, completedAt: status === "COMPLETED" ? new Date().toISOString() : undefined }, { status, completed_at: status === "COMPLETED" ? new Date().toISOString() : null, completed_by: status === "COMPLETED" ? undefined : null });

  const itineraryPayload = (id: string, item: EditableItineraryItem, sequence?: number) => ({
    id,
    trip_id: trip.id,
    date: item.date,
    title: item.title,
    item_type: item.type,
    planned_start_time: item.plannedStartTime || null,
    planned_end_time: item.plannedEndTime || null,
    expected_duration_minutes: item.expectedDurationMinutes ?? null,
    priority: item.priority,
    description: item.description || null,
    transport_instructions: item.transportInstructions || null,
    ...(sequence === undefined ? {} : { sequence }),
  });

  const addItineraryItem = async (item: EditableItineraryItem) => {
    const id = crypto.randomUUID();
    const sequence = Math.max(-1, ...itinerary.filter((entry) => entry.date === item.date).map((entry) => entry.sequence)) + 1;
    const next: ItineraryItem = { id, tripId: trip.id, ...item, sequence, status: "PLANNED" };
    const payload = itineraryPayload(id, item, sequence);
    setItinerary((items) => [...items, next]);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "create", payload }); return; }
    const { error: insertError } = await supabase.from("itinerary_items").insert(payload);
    if (insertError) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "create", payload }); setError("This activity is saved on this device and waiting to sync."); }
  };

  const editItineraryItem = async (id: string, item: EditableItineraryItem) => {
    const current = itinerary.find((entry) => entry.id === id);
    if (!current) return;
    const payload = itineraryPayload(id, item);
    setItinerary((items) => items.map((entry) => entry.id === id ? { ...entry, ...item } : entry));
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload }); return; }
    const { error: updateError } = await supabase.from("itinerary_items").update(payload).eq("id", id);
    if (updateError) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload }); setError("This change is saved on this device and waiting to sync."); }
  };

  const deleteItineraryItem = async (id: string) => {
    const current = itinerary.find((entry) => entry.id === id);
    if (!current) return;
    setItinerary((items) => items.filter((entry) => entry.id !== id));
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const payload = { id };
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "delete", payload }); return; }
    const { error: deleteError } = await supabase.from("itinerary_items").delete().eq("id", id);
    if (deleteError) { setItinerary((items) => [...items, current]); await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "delete", payload }); setError("This deletion is saved on this device and waiting to sync."); }
  };

  const toggleChecklist = async (id: string) => {
    const item = checklist.find((entry) => entry.id === id); if (!item) return;
    const completed = item.status !== "COMPLETED";
    setChecklist((items) => items.map((entry) => entry.id === id ? { ...entry, status: completed ? "COMPLETED" : "PLANNED", completedCount: completed ? entry.targetCount : 0 } : entry));
    const payload = { id, status: completed ? "COMPLETED" : "PLANNED", completed_count: completed ? item.targetCount : 0, completed_at: completed ? new Date().toISOString() : null };
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "update", payload }); return; }
    const { error: updateError } = await supabase.from("checklist_items").update(payload).eq("id", id);
    if (updateError) await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "update", payload });
  };

  const recordFinancialEvent = async (event: FinancialEvent) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setFinancialEvents((events) => [...events, event]); return; }
    if (!navigator.onLine) {
      await enqueueMutation({ tripId: trip.id, entity: "financial", command: event.type, payload: { event } });
      setFinancialEvents((events) => [...events, event]);
      return;
    }
    try { await sendFinancialRpc(supabase, event, trip.id); await refresh(); }
    catch (rpcError) {
      await enqueueMutation({ tripId: trip.id, entity: "financial", command: event.type, payload: { event } });
      setError(rpcError instanceof Error ? rpcError.message : "Money activity is saved locally and waiting to sync.");
    }
  };

  const addChecklistItem: TripBoardData["addChecklistItem"] = async (item) => {
    const id = crypto.randomUUID();
    const next: ChecklistItem = { id, tripId: trip.id, ...item, targetCount: 1, completedCount: 0, status: "PLANNED" };
    setChecklist((items) => [...items, next]);
    const payload = { id, trip_id: trip.id, title: item.title, kind: item.kind, priority: item.priority, planned_day: item.plannedDay ?? null, target_count: 1, completed_count: 0, status: "PLANNED" };
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "create", payload }); return; }
    const { error: insertError } = await supabase.from("checklist_items").insert(payload);
    if (insertError) await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "create", payload });
  };

  return {
    trip, itinerary, checklist, bookings, places, accounts, financialEvents, loading, authRequired, demoMode, dataAvailable, error,
    completeItinerary: (id) => setStatus(id, "COMPLETED"),
    skipItinerary: (id) => setStatus(id, "SKIPPED"),
    moveItinerary: (id, date, time) => updateItinerary(id, { date, plannedStartTime: time, status: "MOVED" }, { date, planned_start_time: time ?? null, status: "MOVED" }),
    addItineraryItem, editItineraryItem, deleteItineraryItem,
    toggleChecklist, addChecklistItem, recordFinancialEvent, refresh,
  };
}

async function sendFinancialRpc(supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>, event: FinancialEvent, tripId: string) {
  const common = { p_trip_id: tripId, p_idempotency_key: event.idempotencyKey, p_occurred_at: event.occurredAt, p_description: event.description };
  let result;
  switch (event.type) {
    case "PURCHASE": result = await supabase.rpc("create_purchase", { ...common, p_source_account_id: event.sourceAccountId, p_amount: event.consumptionAmount ?? event.sourceAmount, p_currency: event.consumptionCurrency ?? event.sourceCurrency, p_category: event.category ?? "Miscellaneous", p_merchant: undefined, p_estimated_inr_amount: event.estimatedInrAmount, p_settled_inr_amount: event.settledInrAmount }); break;
    case "FUND_WALLET": result = await supabase.rpc("fund_wallet", { ...common, p_source_account_id: event.sourceAccountId, p_destination_account_id: event.destinationAccountId, p_destination_amount: event.destinationAmount, p_currency: event.destinationCurrency, p_estimated_inr_amount: event.estimatedInrAmount, p_settled_inr_amount: event.settledInrAmount }); break;
    case "INTERNAL_TRANSFER": result = await supabase.rpc("create_internal_transfer", { ...common, p_source_account_id: event.sourceAccountId, p_destination_account_id: event.destinationAccountId, p_source_amount: event.sourceAmount, p_source_currency: event.sourceCurrency, p_destination_amount: event.destinationAmount, p_destination_currency: event.destinationCurrency }); break;
    case "CASH_EXCHANGE": result = await supabase.rpc("create_cash_exchange", { ...common, p_source_account_id: event.sourceAccountId, p_destination_account_id: event.destinationAccountId, p_source_amount: event.sourceAmount, p_source_currency: event.sourceCurrency, p_destination_amount: event.destinationAmount, p_destination_currency: event.destinationCurrency, p_settled_inr_amount: event.settledInrAmount ?? event.sourceAmount }); break;
    case "PURCHASE_REFUND": result = await supabase.rpc("create_purchase_refund", { ...common, p_original_transaction_id: event.originalTransactionId, p_destination_account_id: event.destinationAccountId, p_amount: event.consumptionAmount ?? event.destinationAmount, p_currency: event.consumptionCurrency ?? event.destinationCurrency, p_settled_inr_amount: event.settledInrAmount }); break;
    case "FUNDING_REFUND": result = await supabase.rpc("create_funding_refund", { ...common, p_source_account_id: event.sourceAccountId, p_destination_account_id: event.destinationAccountId, p_amount: event.sourceAmount, p_currency: event.sourceCurrency, p_settled_inr_amount: event.settledInrAmount }); break;
    case "BALANCE_ADJUSTMENT": result = await supabase.rpc("create_balance_adjustment", { ...common, p_account_id: event.destinationAccountId ?? event.sourceAccountId, p_adjustment: event.destinationAmount ?? event.sourceAmount, p_currency: event.destinationCurrency ?? event.sourceCurrency }); break;
  }
  if (result?.error) throw new Error(result.error.message);
}
