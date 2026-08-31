"use client";

import { useCallback, useEffect, useState } from "react";
import type { Booking, Budget, ChecklistItem, ItineraryDay, ItineraryDetails, ItineraryItem, ItineraryStatus, Place, Trip, TripNote } from "../../types/domain";
import type { FinancialEvent, PaymentAccount } from "../money/domain";
import { enqueueMutation, replayQueue } from "../../lib/offline/queue";
import { offlineDb, type CachedTripRecord } from "../../lib/offline/db";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { classifySyncFailure } from "../../lib/offline/conflicts";
import { demoAccounts, demoBookings, demoBudgets, demoChecklist, demoFinancialEvents, demoItinerary, demoPlaces, demoTrip } from "./demo-data";

export interface TripBoardData {
  trip: Trip;
  itinerary: ItineraryItem[];
  checklist: ChecklistItem[];
  bookings: Booking[];
  places: Place[];
  days: ItineraryDay[];
  accounts: PaymentAccount[];
  budgets: Budget[];
  financialEvents: FinancialEvent[];
  notes: TripNote[];
  unreadNotificationCount: number;
  loading: boolean;
  authRequired: boolean;
  demoMode: boolean;
  dataAvailable: boolean;
  error?: string;
  createTrip: (trip: Pick<Trip, "name" | "startDate" | "endDate" | "timezone" | "baseCurrency">) => Promise<void>;
  completeItinerary: (id: string) => Promise<void>;
  skipItinerary: (id: string) => Promise<void>;
  moveItinerary: (id: string, date: string, time: string | undefined, reason: string) => Promise<void>;
  reorderItinerary: (date: string, itemIds: string[], reason: string) => Promise<void>;
  addItineraryItem: (item: EditableItineraryItem) => Promise<void>;
  editItineraryItem: (id: string, item: EditableItineraryItem) => Promise<void>;
  deleteItineraryItem: (id: string) => Promise<void>;
  toggleChecklist: (id: string) => Promise<void>;
  addChecklistItem: (item: Pick<ChecklistItem, "title" | "kind" | "priority"> & Partial<Pick<ChecklistItem, "plannedDay" | "description" | "notes" | "targetCount" | "rating" | "favourite" | "linkedPlaceId">>) => Promise<void>;
  editChecklistItem: (id: string, patch: Partial<ChecklistItem>) => Promise<void>;
  deleteChecklistItem: (id: string) => Promise<void>;
  addPlace: (place: Omit<Place, "id" | "tripId">) => Promise<void>;
  editPlace: (id: string, place: Omit<Place, "id" | "tripId">) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  addBooking: (booking: Omit<Booking, "id" | "tripId" | "files">) => Promise<void>;
  editBooking: (id: string, booking: Omit<Booking, "id" | "tripId" | "files">) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  saveDay: (day: Omit<ItineraryDay, "id" | "tripId">) => Promise<void>;
  recordFinancialEvent: (event: FinancialEvent) => Promise<void>;
  addPaymentAccount: (account: Omit<PaymentAccount, "id" | "archivedAt">) => Promise<void>;
  editPaymentAccount: (id: string, account: Omit<PaymentAccount, "id" | "archivedAt">) => Promise<void>;
  archivePaymentAccount: (id: string) => Promise<void>;
  addBudget: (budget: Omit<Budget, "id" | "tripId">) => Promise<void>;
  editBudget: (id: string, budget: Omit<Budget, "id" | "tripId">) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addNote: (note: Pick<TripNote, "section" | "title" | "body">) => Promise<void>;
  editNote: (id: string, note: Pick<TripNote, "section" | "title" | "body">) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  settleFinancialTransaction: (id: string, version: number, settledInrAmount: string) => Promise<void>;
  voidFinancialTransaction: (id: string, version: number, reason: string) => Promise<void>;
  updateTripSettings: (settings: Pick<Trip, "name" | "timezone" | "baseCurrency">) => Promise<void>;
  refresh: () => Promise<void>;
}

export type EditableItineraryItem = Pick<ItineraryItem, "date" | "title" | "type" | "plannedStartTime" | "plannedEndTime" | "expectedDurationMinutes" | "priority" | "description" | "transportInstructions" | "placeId" | "bookingId" | "checklistItemId">;

type TripSnapshot = Pick<TripBoardData, "trip" | "itinerary" | "checklist" | "bookings" | "places" | "days" | "accounts" | "budgets" | "financialEvents" | "notes">;

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
  setBookings: (value: Booking[]) => void;
  setPlaces: (value: Place[]) => void;
  setDays: (value: ItineraryDay[]) => void;
  setAccounts: (value: PaymentAccount[]) => void;
  setBudgets: (value: Budget[]) => void;
  setFinancialEvents: (value: FinancialEvent[]) => void;
  setNotes: (value: TripNote[]) => void;
}) {
  setters.setTrip(snapshot.trip);
  setters.setItinerary(snapshot.itinerary);
  setters.setChecklist(snapshot.checklist);
  setters.setBookings(snapshot.bookings);
  setters.setPlaces(snapshot.places);
  setters.setDays(snapshot.days);
  setters.setAccounts(snapshot.accounts);
  setters.setBudgets(snapshot.budgets ?? []);
  setters.setFinancialEvents(snapshot.financialEvents);
  setters.setNotes(snapshot.notes ?? []);
}

const mapAccount = (row: Record<string, unknown>): PaymentAccount => ({
  id: String(row.id), name: String(row.name), accountClass: row.account_class as PaymentAccount["accountClass"], currency: String(row.currency),
  openingBalance: String(row.opening_balance), accountType: row.account_type ? String(row.account_type) : undefined, archivedAt: row.archived_at ? String(row.archived_at) : undefined, version: row.version ? Number(row.version) : 1,
});

const mapBudget = (row: Record<string, unknown>): Budget => ({
  id: String(row.id), tripId: String(row.trip_id), amount: String(row.amount), currency: String(row.currency), scope: row.budget_scope as Budget["scope"],
  category: row.category ? String(row.category) : undefined, date: row.date ? String(row.date) : undefined, version: row.version ? Number(row.version) : 1,
});

const mapFinancialEvent = (row: Record<string, unknown>): FinancialEvent => ({
  id: String(row.id), idempotencyKey: String(row.idempotency_key), type: row.transaction_type as FinancialEvent["type"], occurredAt: String(row.occurred_at), description: String(row.description),
  merchant: row.merchant ? String(row.merchant) : undefined, category: row.category ? String(row.category) : undefined, sourceAccountId: row.source_account_id ? String(row.source_account_id) : undefined,
  destinationAccountId: row.destination_account_id ? String(row.destination_account_id) : undefined, sourceAmount: row.source_amount ? String(row.source_amount) : undefined,
  sourceCurrency: row.source_currency ? String(row.source_currency) : undefined, destinationAmount: row.destination_amount ? String(row.destination_amount) : undefined,
  destinationCurrency: row.destination_currency ? String(row.destination_currency) : undefined, consumptionAmount: row.consumption_amount ? String(row.consumption_amount) : undefined,
  consumptionCurrency: row.consumption_currency ? String(row.consumption_currency) : undefined, estimatedInrAmount: row.estimated_inr_amount ? String(row.estimated_inr_amount) : undefined,
  settledInrAmount: row.settled_inr_amount ? String(row.settled_inr_amount) : undefined, settlementStatus: row.settlement_status as FinancialEvent["settlementStatus"],
  originalTransactionId: row.original_transaction_id ? String(row.original_transaction_id) : undefined, version: row.version ? Number(row.version) : 1, voidedAt: row.voided_at ? String(row.voided_at) : undefined,
});

const mapItinerary = (row: Record<string, unknown>): ItineraryItem => ({
  id: String(row.id), tripId: String(row.trip_id), date: String(row.date), title: String(row.title), description: row.description ? String(row.description) : undefined,
  type: row.item_type as ItineraryItem["type"], plannedStartTime: row.planned_start_time ? String(row.planned_start_time).slice(0, 5) : undefined,
  plannedEndTime: row.planned_end_time ? String(row.planned_end_time).slice(0, 5) : undefined, expectedDurationMinutes: row.expected_duration_minutes ? Number(row.expected_duration_minutes) : undefined,
  recommendedDepartureTime: row.recommended_departure_time ? String(row.recommended_departure_time).slice(0, 5) : undefined, priority: row.priority as ItineraryItem["priority"],
  status: row.status as ItineraryStatus, sequence: Number(row.sequence), completedAt: row.completed_at ? String(row.completed_at) : undefined,
  bookingId: row.booking_id ? String(row.booking_id) : undefined, placeId: row.place_id ? String(row.place_id) : undefined, checklistItemId: row.checklist_item_id ? String(row.checklist_item_id) : undefined, mapsUrl: row.maps_url ? String(row.maps_url) : undefined, transportInstructions: row.transport_instructions ? String(row.transport_instructions) : undefined, changeReason: row.change_reason ? String(row.change_reason) : undefined,
  details: row.details && typeof row.details === "object" ? row.details as ItineraryDetails : undefined, version: row.version ? Number(row.version) : 1,
});

const mapChecklist = (row: Record<string, unknown>): ChecklistItem => ({
  id: String(row.id), tripId: String(row.trip_id), title: String(row.title), description: row.description ? String(row.description) : undefined,
  kind: row.kind as ChecklistItem["kind"], priority: row.priority as ChecklistItem["priority"], targetCount: Number(row.target_count), completedCount: Number(row.completed_count),
  plannedDay: row.planned_day ? String(row.planned_day) : undefined, status: row.status as ChecklistItem["status"], neighbourhood: row.neighbourhood ? String(row.neighbourhood) : undefined,
  dietaryWarning: row.dietary_warning ? String(row.dietary_warning) : undefined, notes: row.notes ? String(row.notes) : undefined, rating: row.rating ? Number(row.rating) : undefined, favourite: Boolean(row.favourite), linkedPlaceId: row.linked_place_id ? String(row.linked_place_id) : undefined, version: row.version ? Number(row.version) : 1,
});

export function useTripBoardData(): TripBoardData {
  // All initial values are deliberately independent of runtime environment so
  // SSR and the browser's hydration pass render the same loading screen.
  const [trip, setTrip] = useState<Trip>(emptyTrip);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [financialEvents, setFinancialEvents] = useState<FinancialEvent[]>([]);
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
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
      applySnapshot({ trip: demoTrip, itinerary: demoItinerary, checklist: demoChecklist, bookings: demoBookings.map((booking) => ({ ...booking, tripId: demoTrip.id, status: booking.status.toUpperCase() as Booking["status"] })), places: demoPlaces.map((place) => ({ ...place, tripId: demoTrip.id })), days: [], accounts: demoAccounts, budgets: demoBudgets, financialEvents: demoFinancialEvents, notes: [] }, { setTrip, setItinerary, setChecklist, setBookings, setPlaces, setDays, setAccounts, setBudgets, setFinancialEvents, setNotes });
      setDemoMode(true);
      setUnreadNotificationCount(0);
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
        applySnapshot(snapshot, { setTrip, setItinerary, setChecklist, setBookings, setPlaces, setDays, setAccounts, setBudgets, setFinancialEvents, setNotes });
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
    const nextTrip: Trip = { id: tripRow.id, name: tripRow.name, startDate: tripRow.start_date, endDate: tripRow.end_date, timezone: tripRow.timezone, baseCurrency: tripRow.base_currency, version: tripRow.version ?? 1 };
    const [itemsResult, checklistResult, bookingResult, placeResult, daysResult, accountResult, budgetResult, financialResult, notesResult, unreadResult] = await Promise.all([
      supabase.from("itinerary_items").select("*").eq("trip_id", tripRow.id).order("date").order("sequence"),
      supabase.from("checklist_items").select("*").eq("trip_id", tripRow.id).order("priority"),
      supabase.from("bookings").select("*, booking_files(id, filename, mime_type, storage_path)").eq("trip_id", tripRow.id).order("starts_at"),
      supabase.from("places").select("*").eq("trip_id", tripRow.id).order("name"),
      supabase.from("itinerary_days").select("*").eq("trip_id", tripRow.id).order("date"),
      supabase.from("payment_accounts").select("*").eq("trip_id", tripRow.id).order("account_class"),
      supabase.from("budgets").select("*").eq("trip_id", tripRow.id).order("created_at"),
      supabase.from("financial_transactions").select("*").eq("trip_id", tripRow.id).order("occurred_at"),
      supabase.from("trip_notes").select("*").eq("trip_id", tripRow.id).order("section").order("sort_order").order("created_at"),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("trip_id", tripRow.id).is("read_at", null),
    ]);
    if (itemsResult.error || checklistResult.error || bookingResult.error || placeResult.error || daysResult.error || accountResult.error || budgetResult.error || financialResult.error || notesResult.error || unreadResult.error) { await loadCachedSnapshot("Some trip data could not be refreshed. Try again when your connection improves."); return; }
    setTrip(nextTrip);
    setItinerary((itemsResult.data ?? []).map((row) => mapItinerary(row as Record<string, unknown>)));
    setChecklist((checklistResult.data ?? []).map((row) => mapChecklist(row as Record<string, unknown>)));
    setBookings((bookingResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, title: row.title, type: row.type, provider: row.provider ?? undefined, reference: row.booking_reference ?? undefined, startsAt: row.starts_at ?? undefined, location: row.location ?? undefined, travellers: row.travellers ?? undefined, amount: row.amount?.toString(), currency: row.currency ?? undefined, notes: row.notes ?? undefined, status: row.status, version: row.version ?? 1, files: (row.booking_files ?? []).map((file: { id?: string; filename: string; mime_type: string; storage_path: string }) => ({ id: file.id, name: file.filename, kind: file.mime_type === "application/pdf" ? "PDF" : "Image", path: file.storage_path })) })));
    setPlaces((placeResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, name: row.name, neighbourhood: row.neighbourhood ?? undefined, category: row.category ?? undefined, address: row.address ?? undefined, mapsUrl: row.google_maps_url ?? undefined, openingHoursNotes: row.opening_hours_notes ?? undefined, notes: row.notes ?? undefined, expectedDurationMinutes: row.expected_duration_minutes ?? undefined, priority: row.priority, version: row.version ?? 1 })));
    setDays((daysResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, date: row.date, title: row.title, notes: row.notes ?? undefined, version: row.version ?? 1 })));
    setAccounts((accountResult.data ?? []).map((row) => mapAccount(row as Record<string, unknown>)));
    setBudgets((budgetResult.data ?? []).map((row) => mapBudget(row as Record<string, unknown>)));
    setFinancialEvents((financialResult.data ?? []).map((row) => mapFinancialEvent(row as Record<string, unknown>)));
    setNotes((notesResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, section: row.section, title: row.title, body: row.body, sortOrder: row.sort_order, version: row.version ?? 1 })));
    setUnreadNotificationCount(unreadResult.count ?? 0);
    const snapshot: TripSnapshot = {
      trip: nextTrip,
      itinerary: (itemsResult.data ?? []).map((row) => mapItinerary(row as Record<string, unknown>)),
      checklist: (checklistResult.data ?? []).map((row) => mapChecklist(row as Record<string, unknown>)),
      bookings: (bookingResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, title: row.title, type: row.type, provider: row.provider ?? undefined, reference: row.booking_reference ?? undefined, startsAt: row.starts_at ?? undefined, location: row.location ?? undefined, travellers: row.travellers ?? undefined, amount: row.amount?.toString(), currency: row.currency ?? undefined, notes: row.notes ?? undefined, status: row.status, version: row.version ?? 1, files: (row.booking_files ?? []).map((file: { id?: string; filename: string; mime_type: string; storage_path: string }) => ({ id: file.id, name: file.filename, kind: file.mime_type === "application/pdf" ? "PDF" : "Image", path: file.storage_path })) })),
      places: (placeResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, name: row.name, neighbourhood: row.neighbourhood ?? undefined, category: row.category ?? undefined, address: row.address ?? undefined, mapsUrl: row.google_maps_url ?? undefined, openingHoursNotes: row.opening_hours_notes ?? undefined, notes: row.notes ?? undefined, expectedDurationMinutes: row.expected_duration_minutes ?? undefined, priority: row.priority, version: row.version ?? 1 })),
      days: (daysResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, date: row.date, title: row.title, notes: row.notes ?? undefined, version: row.version ?? 1 })),
      accounts: (accountResult.data ?? []).map((row) => mapAccount(row as Record<string, unknown>)),
      budgets: (budgetResult.data ?? []).map((row) => mapBudget(row as Record<string, unknown>)),
      financialEvents: (financialResult.data ?? []).map((row) => mapFinancialEvent(row as Record<string, unknown>)),
      notes: (notesResult.data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, section: row.section, title: row.title, body: row.body, sortOrder: row.sort_order, version: row.version ?? 1 })),
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
    channel.on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `id=eq.${trip.id}` }, () => { void refresh(); });
    for (const table of ["itinerary_days", "itinerary_items", "checklist_items", "bookings", "booking_files", "places", "payment_accounts", "financial_transactions", "budgets", "trip_notes"] as const) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `trip_id=eq.${trip.id}` }, () => { void refresh(); });
    }
    channel.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `trip_id=eq.${trip.id}` }, () => { void refresh(); });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, trip.id]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const sync = () => { void replayQueue(async (mutation) => {
      if (mutation.entity === "itinerary") {
        const rpcResult = mutation.command === "move" ? await supabase.rpc("move_itinerary_item", { p_item_id: mutation.payload.id, p_date: mutation.payload.date, p_time: mutation.payload.time, p_reason: mutation.payload.reason }) : mutation.command === "reorder" ? await supabase.rpc("reorder_itinerary_items", { p_trip_id: mutation.tripId, p_date: mutation.payload.date, p_item_ids: mutation.payload.itemIds, p_reason: mutation.payload.reason }) : null;
        if (!rpcResult && mutation.command === "update" && mutation.payload.expectedVersion !== undefined) { await updateVersionedRow(supabase, "itinerary_items", mutation.payload); }
        const regularResult = rpcResult || mutation.command === "update" && mutation.payload.expectedVersion !== undefined ? null : mutation.command === "create"
          ? await supabase.from("itinerary_items").insert(mutation.payload)
          : mutation.command === "delete"
            ? await supabase.from("itinerary_items").delete().eq("id", mutation.payload.id)
            : await supabase.from("itinerary_items").update(mutation.payload).eq("id", mutation.payload.id);
        const syncError = rpcResult?.error ?? regularResult?.error;
        if (syncError) throw syncError;
      } else if (mutation.entity === "checklist") {
        if (mutation.command === "update" && mutation.payload.expectedVersion !== undefined) { await updateVersionedRow(supabase, "checklist_items", mutation.payload); return; }
        const { error: syncError } = mutation.command === "create"
          ? await supabase.from("checklist_items").insert(mutation.payload)
          : mutation.command === "delete"
            ? await supabase.from("checklist_items").delete().eq("id", mutation.payload.id)
            : await supabase.from("checklist_items").update(mutation.payload).eq("id", mutation.payload.id);
        if (syncError) throw syncError;
      } else if (mutation.entity === "trip-note") {
        const { error: syncError } = mutation.command === "create"
          ? await supabase.from("trip_notes").insert(mutation.payload)
          : mutation.command === "delete"
            ? await supabase.from("trip_notes").delete().eq("id", mutation.payload.id)
            : await supabase.from("trip_notes").update(mutation.payload).eq("id", mutation.payload.id);
        if (syncError) throw syncError;
      } else if (mutation.entity === "place" || mutation.entity === "booking") {
        const table = mutation.entity === "place" ? "places" : "bookings";
        if (mutation.command === "update" && mutation.payload.expectedVersion !== undefined) { await updateVersionedRow(supabase, table, mutation.payload); return; }
        const { error: syncError } = mutation.command === "create"
          ? await supabase.from(table).insert(mutation.payload)
          : mutation.command === "delete"
            ? await supabase.from(table).delete().eq("id", mutation.payload.id)
            : await supabase.from(table).update(mutation.payload).eq("id", mutation.payload.id);
        if (syncError) throw syncError;
      } else if (mutation.entity === "booking-file") {
        const path = String(mutation.payload.path); const file = mutation.payload.file as Blob;
        if (mutation.command === "delete") {
          const { error: storageError } = await supabase.storage.from("booking-documents").remove([path]); if (storageError) throw storageError;
          const { error: metadataError } = await supabase.rpc("delete_booking_file_metadata", { p_file_id: mutation.payload.fileId }); if (metadataError) throw metadataError;
        } else {
          const { data: existing } = await supabase.from("booking_files").select("id").eq("id", mutation.payload.id).maybeSingle();
          if (!existing) {
            const { error: storageError } = await supabase.storage.from("booking-documents").upload(path, file, { contentType: String(mutation.payload.mimeType), upsert: false }); if (storageError) throw storageError;
            const { error: metadataError } = await supabase.from("booking_files").insert({ id: mutation.payload.id, trip_id: mutation.tripId, booking_id: mutation.payload.bookingId, storage_path: path, filename: mutation.payload.filename, mime_type: mutation.payload.mimeType, file_size: mutation.payload.fileSize });
            if (metadataError) { await supabase.storage.from("booking-documents").remove([path]); throw metadataError; }
          }
          if (mutation.command === "replace" && mutation.payload.oldPath && mutation.payload.oldFileId) {
            const { error: oldStorageError } = await supabase.storage.from("booking-documents").remove([String(mutation.payload.oldPath)]); if (oldStorageError) throw oldStorageError;
            const { error: oldMetadataError } = await supabase.rpc("delete_booking_file_metadata", { p_file_id: mutation.payload.oldFileId }); if (oldMetadataError) throw oldMetadataError;
          }
        }
      } else if (mutation.entity === "financial") {
        if (mutation.command === "settle") {
          const { error: syncError } = await supabase.rpc("settle_card_transaction", { p_transaction_id: mutation.payload.id, p_expected_version: mutation.payload.version, p_settled_inr_amount: mutation.payload.amount });
          if (syncError) throw syncError;
        } else if (mutation.command === "void") {
          const { error: syncError } = await supabase.rpc("void_financial_transaction", { p_transaction_id: mutation.payload.id, p_expected_version: mutation.payload.version, p_reason: mutation.payload.reason });
          if (syncError) throw syncError;
        } else await sendFinancialRpc(supabase, mutation.payload.event as FinancialEvent, mutation.tripId);
      } else if (mutation.entity === "account" || mutation.entity === "budget") {
        const table = mutation.entity === "account" ? "payment_accounts" : "budgets";
        if (mutation.command === "update" && mutation.payload.expectedVersion !== undefined) { await updateVersionedRow(supabase, table, mutation.payload); return; }
        const { error: syncError } = mutation.command === "create"
          ? await supabase.from(table).insert(mutation.payload)
          : mutation.command === "delete"
            ? await supabase.from(table).delete().eq("id", mutation.payload.id)
            : await supabase.from(table).update(mutation.payload).eq("id", mutation.payload.id);
        if (syncError) throw syncError;
      } else if (mutation.entity === "settings") {
        if (mutation.command === "day-upsert") {
          if (mutation.payload.expectedVersion !== undefined) await updateVersionedRow(supabase, "itinerary_days", mutation.payload);
          else { const { error: syncError } = await supabase.from("itinerary_days").upsert(mutation.payload, { onConflict: "trip_id,date" }); if (syncError) throw syncError; }
        } else {
          await updateVersionedRow(supabase, "trips", mutation.payload);
        }
      } else if (mutation.entity === "notification-preference") {
        const { expectedVersion, ...patch } = mutation.payload;
        if (typeof expectedVersion === "number") {
          const { data, error: syncError } = await supabase.from("notification_preferences").update(patch).eq("user_id", patch.user_id).eq("trip_id", patch.trip_id).eq("version", expectedVersion).select("user_id").maybeSingle();
          if (syncError) throw syncError; if (!data) throw Object.assign(new Error("Version conflict: alert preferences changed on another device."), { code: "40001" });
        } else { const { error: syncError } = await supabase.from("notification_preferences").upsert(patch); if (syncError) throw syncError; }
      } else if (mutation.entity === "member") {
        if (mutation.command === "remove") {
          const rpc = typeof mutation.payload.expectedVersion === "number" ? "remove_trip_member_versioned" : "remove_trip_member";
          const args = typeof mutation.payload.expectedVersion === "number" ? { p_trip_id: mutation.tripId, p_user_id: mutation.payload.userId, p_expected_version: mutation.payload.expectedVersion, p_reason: mutation.payload.reason } : { p_trip_id: mutation.tripId, p_user_id: mutation.payload.userId, p_reason: mutation.payload.reason };
          const { error: syncError } = await supabase.rpc(rpc, args); if (syncError) throw syncError;
        } else if (mutation.command === "revoke-invite") {
          const { error: syncError } = await supabase.from("trip_invites").update({ expires_at: mutation.payload.revokedAt, revoked_at: mutation.payload.revokedAt }).eq("id", mutation.payload.id); if (syncError) throw syncError;
        }
      }
    }).then(refresh); };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("tripboard:sync", sync);
    queueMicrotask(sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("focus", sync); window.removeEventListener("tripboard:sync", sync); };
  }, [refresh]);

  const updateItinerary = async (id: string, patch: Partial<ItineraryItem>, databasePatch: Record<string, unknown>) => {
    const before = itinerary.find((item) => item.id === id); if (!before) return;
    const queuedPayload = { id, ...databasePatch, expectedVersion: before.version ?? 1 };
    setItinerary((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload: queuedPayload }); return; }
    const { error: updateError } = await supabase.from("itinerary_items").update(databasePatch).eq("id", id);
    if (updateError) { if (classifySyncFailure(updateError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload: queuedPayload }); else setItinerary((items) => items.map((item) => item.id === id ? before : item)); setError("This change could not be saved."); }
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
    place_id: item.placeId || null,
    booking_id: item.bookingId || null,
    checklist_item_id: item.checklistItemId || null,
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
    if (insertError) { if (classifySyncFailure(insertError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "create", payload }); else setItinerary((items) => items.filter((entry) => entry.id !== id)); setError("This activity could not be saved."); }
  };

  const editItineraryItem = async (id: string, item: EditableItineraryItem) => {
    const current = itinerary.find((entry) => entry.id === id);
    if (!current) return;
    const payload = { ...itineraryPayload(id, item), expectedVersion: current.version ?? 1 };
    setItinerary((items) => items.map((entry) => entry.id === id ? { ...entry, ...item } : entry));
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload }); return; }
    const { error: updateError } = await supabase.from("itinerary_items").update(withoutExpectedVersion(payload)).eq("id", id);
    if (updateError) { if (classifySyncFailure(updateError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "update", payload }); else setItinerary((items) => items.map((entry) => entry.id === id ? current : entry)); setError("This activity change could not be saved."); }
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
    if (deleteError) { if (classifySyncFailure(deleteError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "delete", payload }); else setItinerary((items) => [...items, current]); setError("This activity could not be deleted."); }
  };

  const moveItinerary: TripBoardData["moveItinerary"] = async (id, date, time, reason) => {
    const current = itinerary.find((item) => item.id === id); if (!current) return;
    const sequence = Math.max(-1, ...itinerary.filter((item) => item.date === date && item.id !== id).map((item) => item.sequence)) + 1;
    setItinerary((items) => items.map((item) => item.id === id ? { ...item, date, plannedStartTime: time, status: "MOVED", sequence, changeReason: reason } : item));
    const client = getSupabaseBrowserClient(); if (!client) return; const payload = { id, date, time: time ?? null, reason };
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "move", payload }); return; }
    const { error: moveError } = await client.rpc("move_itinerary_item", { p_item_id: id, p_date: date, p_time: time ?? null, p_reason: reason });
    if (moveError) { if (classifySyncFailure(moveError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "move", payload }); else setItinerary((items) => items.map((item) => item.id === id ? current : item)); setError("This move could not be saved."); }
  };

  const reorderItinerary: TripBoardData["reorderItinerary"] = async (date, itemIds, reason) => {
    const before = itinerary.filter((item) => item.date === date);
    const sequenceById = new Map(itemIds.map((id, index) => [id, index]));
    setItinerary((items) => items.map((item) => item.date === date && sequenceById.has(item.id) ? { ...item, sequence: sequenceById.get(item.id)!, changeReason: reason } : item));
    const client = getSupabaseBrowserClient(); if (!client) return; const payload = { date, itemIds, reason };
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "reorder", payload }); return; }
    const { error: reorderError } = await client.rpc("reorder_itinerary_items", { p_trip_id: trip.id, p_date: date, p_item_ids: itemIds, p_reason: reason });
    if (reorderError) { if (classifySyncFailure(reorderError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "itinerary", command: "reorder", payload }); else { const prior = new Map(before.map((item) => [item.id, item])); setItinerary((items) => items.map((item) => prior.get(item.id) ?? item)); } setError("This new order could not be saved."); }
  };

  const toggleChecklist = async (id: string) => {
    const item = checklist.find((entry) => entry.id === id); if (!item) return;
    const completed = item.status !== "COMPLETED";
    setChecklist((items) => items.map((entry) => entry.id === id ? { ...entry, status: completed ? "COMPLETED" : "PLANNED", completedCount: completed ? entry.targetCount : 0 } : entry));
    const payload = { id, status: completed ? "COMPLETED" : "PLANNED", completed_count: completed ? item.targetCount : 0, completed_at: completed ? new Date().toISOString() : null, expectedVersion: item.version ?? 1 };
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "update", payload }); return; }
    const { error: updateError } = await supabase.from("checklist_items").update(withoutExpectedVersion(payload)).eq("id", id);
    if (updateError) { if (classifySyncFailure(updateError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "update", payload }); else setChecklist((items) => items.map((entry) => entry.id === id ? item : entry)); setError("This checklist change could not be saved."); }
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
      if (classifySyncFailure(rpcError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "financial", command: event.type, payload: { event } });
      setError(rpcError instanceof Error ? rpcError.message : "Money activity is saved locally and waiting to sync.");
    }
  };

  const accountPayload = (id: string, account: Omit<PaymentAccount, "id" | "archivedAt">) => ({
    id, trip_id: trip.id, name: account.name, account_class: account.accountClass,
    account_type: account.accountType ?? (account.accountClass === "STORED_VALUE" ? "WALLET" : "CARD"),
    currency: account.currency, opening_balance: account.openingBalance,
  });
  const saveAccount = async (command: "create" | "update", id: string, account: Omit<PaymentAccount, "id" | "archivedAt">) => {
    const current = accounts.find((item) => item.id === id); const payload = { ...accountPayload(id, account), ...(command === "update" ? { expectedVersion: current?.version ?? 1 } : {}) }; const client = getSupabaseBrowserClient();
    if (!client) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "account", command, payload }); return; }
    const result = command === "create" ? await client.from("payment_accounts").insert(payload) : await client.from("payment_accounts").update(withoutExpectedVersion(payload)).eq("id", id);
    if (result.error) { if (classifySyncFailure(result.error) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "account", command, payload }); else if (current) setAccounts((items) => items.map((item) => item.id === id ? current : item)); else setAccounts((items) => items.filter((item) => item.id !== id)); setError("Account change could not be saved."); }
  };
  const addPaymentAccount: TripBoardData["addPaymentAccount"] = async (account) => { const id = crypto.randomUUID(); setAccounts((items) => [...items, { ...account, id, version: 1 }]); await saveAccount("create", id, account); };
  const editPaymentAccount: TripBoardData["editPaymentAccount"] = async (id, account) => { const before = accounts.find((item) => item.id === id); if (!before) return; setAccounts((items) => items.map((item) => item.id === id ? { ...account, id, version: before.version } : item)); await saveAccount("update", id, account); };
  const archivePaymentAccount: TripBoardData["archivePaymentAccount"] = async (id) => {
    const before = accounts.find((item) => item.id === id); if (!before) return; const archivedAt = new Date().toISOString();
    setAccounts((items) => items.map((item) => item.id === id ? { ...item, archivedAt } : item)); const client = getSupabaseBrowserClient(); if (!client) return;
    const payload = { id, archived_at: archivedAt, expectedVersion: before.version ?? 1 }; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "account", command: "update", payload }); return; }
    const { error: archiveError } = await client.from("payment_accounts").update({ archived_at: archivedAt }).eq("id", id);
    if (archiveError) { setAccounts((items) => items.map((item) => item.id === id ? before : item)); setError("This account could not be archived."); }
  };

  const budgetPayload = (id: string, budget: Omit<Budget, "id" | "tripId">) => ({ id, trip_id: trip.id, amount: budget.amount, currency: budget.currency, budget_scope: budget.scope, category: budget.scope === "CATEGORY" ? budget.category : null, date: budget.scope === "DAILY" ? budget.date : null });
  const saveBudget = async (command: "create" | "update", id: string, budget: Omit<Budget, "id" | "tripId">) => {
    const current = budgets.find((item) => item.id === id); const payload = { ...budgetPayload(id, budget), ...(command === "update" ? { expectedVersion: current?.version ?? 1 } : {}) }; const client = getSupabaseBrowserClient(); if (!client) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "budget", command, payload }); return; }
    const result = command === "create" ? await client.from("budgets").insert(payload) : await client.from("budgets").update(withoutExpectedVersion(payload)).eq("id", id);
    if (result.error) { if (classifySyncFailure(result.error) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "budget", command, payload }); else if (current) setBudgets((items) => items.map((item) => item.id === id ? current : item)); else setBudgets((items) => items.filter((item) => item.id !== id)); setError("Budget change could not be saved."); }
  };
  const addBudget: TripBoardData["addBudget"] = async (budget) => { const id = crypto.randomUUID(); setBudgets((items) => [...items, { ...budget, id, tripId: trip.id, version: 1 }]); await saveBudget("create", id, budget); };
  const editBudget: TripBoardData["editBudget"] = async (id, budget) => { const before = budgets.find((item) => item.id === id); if (!before) return; setBudgets((items) => items.map((item) => item.id === id ? { ...budget, id, tripId: trip.id, version: before.version } : item)); await saveBudget("update", id, budget); };
  const deleteBudget: TripBoardData["deleteBudget"] = async (id) => {
    const before = budgets.find((item) => item.id === id); if (!before) return; setBudgets((items) => items.filter((item) => item.id !== id)); const client = getSupabaseBrowserClient(); if (!client) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "budget", command: "delete", payload: { id } }); return; }
    const { error: deleteError } = await client.from("budgets").delete().eq("id", id); if (deleteError) { setBudgets((items) => [...items, before]); setError("This budget could not be deleted."); }
  };

  const settleFinancialTransaction: TripBoardData["settleFinancialTransaction"] = async (id, version, settledInrAmount) => {
    const before = financialEvents.find((event) => event.id === id); if (!before) return;
    setFinancialEvents((events) => events.map((event) => event.id === id ? { ...event, settledInrAmount, settlementStatus: "SETTLED", version: version + 1 } : event));
    const client = getSupabaseBrowserClient(); if (!client) return; const payload = { id, version, amount: settledInrAmount };
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "financial", command: "settle", payload }); return; }
    const { error: settleError } = await client.rpc("settle_card_transaction", { p_transaction_id: id, p_expected_version: version, p_settled_inr_amount: settledInrAmount });
    if (settleError) { setFinancialEvents((events) => events.map((event) => event.id === id ? before : event)); setError(settleError.message); }
  };
  const voidFinancialTransaction: TripBoardData["voidFinancialTransaction"] = async (id, version, reason) => {
    const before = financialEvents.find((event) => event.id === id); if (!before) return; const voidedAt = new Date().toISOString();
    setFinancialEvents((events) => events.map((event) => event.id === id ? { ...event, voidedAt, description: `${event.description} [VOID: ${reason}]`, version: version + 1 } : event));
    const client = getSupabaseBrowserClient(); if (!client) return; const payload = { id, version, reason };
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "financial", command: "void", payload }); return; }
    const { error: voidError } = await client.rpc("void_financial_transaction", { p_transaction_id: id, p_expected_version: version, p_reason: reason });
    if (voidError) { setFinancialEvents((events) => events.map((event) => event.id === id ? before : event)); setError(voidError.message); }
  };

  const addChecklistItem: TripBoardData["addChecklistItem"] = async (item) => {
    const id = crypto.randomUUID();
    const next: ChecklistItem = { id, tripId: trip.id, ...item, targetCount: item.targetCount ?? 1, completedCount: 0, status: "PLANNED" };
    setChecklist((items) => [...items, next]);
    const payload = { id, trip_id: trip.id, title: item.title, kind: item.kind, priority: item.priority, planned_day: item.plannedDay ?? null, description: item.description ?? null, notes: item.notes ?? null, target_count: item.targetCount ?? 1, completed_count: 0, rating: item.rating ?? null, favourite: item.favourite ?? false, linked_place_id: item.linkedPlaceId ?? null, status: "PLANNED" };
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "create", payload }); return; }
    const { error: insertError } = await supabase.from("checklist_items").insert(payload);
    if (insertError) { if (classifySyncFailure(insertError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "create", payload }); else setChecklist((items) => items.filter((entry) => entry.id !== id)); setError("This checklist item could not be saved."); }
  };

  const editChecklistItem: TripBoardData["editChecklistItem"] = async (id, patch) => {
    const before = checklist.find((item) => item.id === id); if (!before) return;
    const payload: Record<string, unknown> = { id, expectedVersion: before.version ?? 1 };
    const fields: [keyof ChecklistItem, string][] = [["title","title"],["description","description"],["kind","kind"],["priority","priority"],["targetCount","target_count"],["completedCount","completed_count"],["plannedDay","planned_day"],["status","status"],["notes","notes"],["neighbourhood","neighbourhood"],["rating","rating"],["favourite","favourite"],["linkedPlaceId","linked_place_id"]];
    for (const [key, column] of fields) if (key in patch) payload[column] = patch[key] ?? null;
    setChecklist((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
    const client = getSupabaseBrowserClient(); if (!client) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "update", payload }); return; }
    const { error: saveError } = await client.from("checklist_items").update(withoutExpectedVersion(payload)).eq("id", id);
    if (saveError) { if (classifySyncFailure(saveError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "update", payload }); else setChecklist((items) => items.map((item) => item.id === id ? before : item)); setError("Checklist change could not be saved."); }
  };

  const deleteChecklistItem: TripBoardData["deleteChecklistItem"] = async (id) => {
    const before = checklist.find((item) => item.id === id); if (!before) return;
    setChecklist((items) => items.filter((item) => item.id !== id));
    const client = getSupabaseBrowserClient(); if (!client) return;
    const payload = { id }; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "checklist", command: "delete", payload }); return; }
    const { error: saveError } = await client.from("checklist_items").delete().eq("id", id);
    if (saveError) { setChecklist((items) => [...items, before]); setError("Could not delete this checklist item."); }
  };

  const placePayload = (id: string, place: Omit<Place, "id" | "tripId">) => ({ id, trip_id: trip.id, name: place.name, address: place.address ?? null, google_maps_url: place.mapsUrl ?? null, neighbourhood: place.neighbourhood ?? null, category: place.category ?? null, opening_hours_notes: place.openingHoursNotes ?? null, notes: place.notes ?? null, expected_duration_minutes: place.expectedDurationMinutes ?? null, priority: place.priority });
  const savePlace = async (command: "create" | "update", id: string, place: Omit<Place, "id" | "tripId">) => {
    const current = places.find((item) => item.id === id); const payload = { ...placePayload(id, place), ...(command === "update" ? { expectedVersion: current?.version ?? 1 } : {}) }; const client = getSupabaseBrowserClient();
    if (!client) return; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "place", command, payload }); return; }
    const result = command === "create" ? await client.from("places").insert(payload) : await client.from("places").update(withoutExpectedVersion(payload)).eq("id", id);
    if (result.error) { if (classifySyncFailure(result.error) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "place", command, payload }); else if (current) setPlaces((items) => items.map((item) => item.id === id ? current : item)); else setPlaces((items) => items.filter((item) => item.id !== id)); setError("Place change could not be saved."); }
  };
  const addPlace: TripBoardData["addPlace"] = async (place) => { const id = crypto.randomUUID(); setPlaces((items) => [...items, { ...place, id, tripId: trip.id, version: 1 }]); await savePlace("create", id, place); };
  const editPlace: TripBoardData["editPlace"] = async (id, place) => { const previous = places.find((item) => item.id === id); if (!previous) return; setPlaces((items) => items.map((item) => item.id === id ? { ...place, id, tripId: trip.id, version: previous.version } : item)); await savePlace("update", id, place); };
  const deletePlace: TripBoardData["deletePlace"] = async (id) => { const previous = places.find((item) => item.id === id); if (!previous) return; setPlaces((items) => items.filter((item) => item.id !== id)); const client = getSupabaseBrowserClient(); if (!client) return; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "place", command: "delete", payload: { id } }); return; } const { error: saveError } = await client.from("places").delete().eq("id", id); if (saveError) { setPlaces((items) => [...items, previous]); setError("Could not delete this place."); } };

  const bookingPayload = (id: string, booking: Omit<Booking, "id" | "tripId" | "files">) => ({ id, trip_id: trip.id, type: booking.type, title: booking.title, provider: booking.provider ?? null, booking_reference: booking.reference ?? null, starts_at: booking.startsAt ?? null, location: booking.location ?? null, travellers: booking.travellers ?? null, amount: booking.amount ?? null, currency: booking.currency ?? null, notes: booking.notes ?? null, status: booking.status });
  const saveBooking = async (command: "create" | "update", id: string, booking: Omit<Booking, "id" | "tripId" | "files">) => { const current = bookings.find((item) => item.id === id); const payload = { ...bookingPayload(id, booking), ...(command === "update" ? { expectedVersion: current?.version ?? 1 } : {}) }; const client = getSupabaseBrowserClient(); if (!client) return; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "booking", command, payload }); return; } const databasePayload = withoutExpectedVersion(payload); const result = command === "create" ? await client.from("bookings").insert(databasePayload) : await client.from("bookings").update(databasePayload).eq("id", id); if (result.error) { if (classifySyncFailure(result.error) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "booking", command, payload }); else if (current) setBookings((items) => items.map((item) => item.id === id ? current : item)); else setBookings((items) => items.filter((item) => item.id !== id)); setError("Booking change could not be saved."); } };
  const addBooking: TripBoardData["addBooking"] = async (booking) => { const id = crypto.randomUUID(); setBookings((items) => [...items, { ...booking, id, tripId: trip.id, files: [], version: 1 }]); await saveBooking("create", id, booking); };
  const editBooking: TripBoardData["editBooking"] = async (id, booking) => { const current = bookings.find((item) => item.id === id); if (!current) return; setBookings((items) => items.map((item) => item.id === id ? { ...booking, id, tripId: trip.id, files: current.files, version: current.version } : item)); await saveBooking("update", id, booking); };
  const deleteBooking: TripBoardData["deleteBooking"] = async (id) => { const current = bookings.find((item) => item.id === id); if (!current) return; setBookings((items) => items.filter((item) => item.id !== id)); const client = getSupabaseBrowserClient(); if (!client) return; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "booking", command: "delete", payload: { id } }); return; } const { error: saveError } = await client.from("bookings").delete().eq("id", id); if (saveError) { setBookings((items) => [...items, current]); setError("Could not delete this booking."); } };

  const saveDay: TripBoardData["saveDay"] = async (day) => { const before = days.find((item) => item.date === day.date); const id = before?.id ?? crypto.randomUUID(); const payload = { id, trip_id: trip.id, ...day, ...(before ? { expectedVersion: before.version ?? 1 } : {}) }; setDays((items) => [...items.filter((item) => item.date !== day.date), { ...day, id, tripId: trip.id, version: before?.version ?? 1 }].sort((a, b) => a.date.localeCompare(b.date))); const client = getSupabaseBrowserClient(); if (!client) return; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "settings", command: "day-upsert", payload }); return; } const { error: saveError } = await client.from("itinerary_days").upsert(withoutExpectedVersion(payload), { onConflict: "trip_id,date" }); if (saveError) { if (classifySyncFailure(saveError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "settings", command: "day-upsert", payload }); else setDays((items) => [...items.filter((item) => item.date !== day.date), ...(before ? [before] : [])].sort((a, b) => a.date.localeCompare(b.date))); setError("Day details could not be saved."); } };

  const updateTripSettings: TripBoardData["updateTripSettings"] = async (settings) => {
    const previous = trip;
    setTrip((current) => ({ ...current, ...settings }));
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const payload = { id: trip.id, name: settings.name, timezone: settings.timezone, base_currency: settings.baseCurrency, expectedVersion: previous.version ?? 1 };
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "settings", command: "update", payload }); return; }
    const { error: updateError } = await supabase.from("trips").update({ name: settings.name, timezone: settings.timezone, base_currency: settings.baseCurrency }).eq("id", trip.id);
    if (updateError) { if (classifySyncFailure(updateError) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "settings", command: "update", payload }); else setTrip(previous); setError("Trip settings could not be saved. Please try again."); return; }
    await refresh();
  };

  const createTrip: TripBoardData["createTrip"] = async (input) => {
    const client = getSupabaseBrowserClient();
    if (!client) { setError("Connect Supabase before creating a private trip."); return; }
    const { error: createError } = await client.rpc("create_shared_trip", {
      p_name: input.name.trim(), p_start_date: input.startDate, p_end_date: input.endDate,
      p_timezone: input.timezone, p_base_currency: input.baseCurrency,
    });
    if (createError) { setError(createError.message || "The trip could not be created."); return; }
    setLoading(true); await refresh();
  };

  const saveNote = async (command: "create" | "update", id: string, note: Pick<TripNote, "section" | "title" | "body">) => {
    const current = notes.find((item) => item.id === id);
    const payload = { id, trip_id: trip.id, section: note.section.trim(), title: note.title.trim(), body: note.body.trim(), sort_order: current?.sortOrder ?? notes.filter((item) => item.section === note.section).length };
    const client = getSupabaseBrowserClient(); if (!client) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "trip-note", command, payload }); return; }
    const result = command === "create" ? await client.from("trip_notes").insert(payload) : await client.from("trip_notes").update(payload).eq("id", id);
    if (result.error) { if (classifySyncFailure(result.error) === "RETRYABLE") await enqueueMutation({ tripId: trip.id, entity: "trip-note", command, payload }); else { setNotes((items) => command === "create" ? items.filter((item) => item.id !== id) : current ? items.map((item) => item.id === id ? current : item) : items); setError("Important note could not be saved."); } }
  };
  const addNote: TripBoardData["addNote"] = async (note) => { const id = crypto.randomUUID(); setNotes((items) => [...items, { id, tripId: trip.id, ...note, sortOrder: items.filter((item) => item.section === note.section).length, version: 1 }]); await saveNote("create", id, note); };
  const editNote: TripBoardData["editNote"] = async (id, note) => { const before = notes.find((item) => item.id === id); if (!before) return; setNotes((items) => items.map((item) => item.id === id ? { ...item, ...note } : item)); await saveNote("update", id, note); };
  const deleteNote: TripBoardData["deleteNote"] = async (id) => { const before = notes.find((item) => item.id === id); if (!before) return; setNotes((items) => items.filter((item) => item.id !== id)); const client = getSupabaseBrowserClient(); if (!client) return; const payload = { id }; if (!navigator.onLine) { await enqueueMutation({ tripId: trip.id, entity: "trip-note", command: "delete", payload }); return; } const { error: deleteError } = await client.from("trip_notes").delete().eq("id", id); if (deleteError) { setNotes((items) => [...items, before]); setError("Important note could not be deleted."); } };

  return {
    trip, itinerary, checklist, bookings, places, days, accounts, budgets, financialEvents, notes, unreadNotificationCount, loading, authRequired, demoMode, dataAvailable, error, createTrip,
    completeItinerary: (id) => setStatus(id, "COMPLETED"),
    skipItinerary: (id) => setStatus(id, "SKIPPED"),
    moveItinerary, reorderItinerary, addItineraryItem, editItineraryItem, deleteItineraryItem,
    toggleChecklist, addChecklistItem, editChecklistItem, deleteChecklistItem, addPlace, editPlace, deletePlace, addBooking, editBooking, deleteBooking, saveDay, recordFinancialEvent,
    addPaymentAccount, editPaymentAccount, archivePaymentAccount, addBudget, editBudget, deleteBudget, addNote, editNote, deleteNote, settleFinancialTransaction, voidFinancialTransaction, updateTripSettings, refresh,
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

async function updateVersionedRow(supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>, table: "trips" | "itinerary_days" | "itinerary_items" | "checklist_items" | "places" | "bookings" | "payment_accounts" | "budgets", payload: Record<string, unknown>) {
  const { id, expectedVersion, ...patch } = payload;
  let query = supabase.from(table).update(patch).eq("id", id);
  if (typeof expectedVersion === "number") query = query.eq("version", expectedVersion);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (typeof expectedVersion === "number" && !data) throw Object.assign(new Error("Version conflict: the shared record changed before this offline edit could sync."), { code: "40001" });
}

function withoutExpectedVersion(payload: Record<string, unknown>) {
  const patch = { ...payload };
  delete patch.expectedVersion;
  return patch;
}
