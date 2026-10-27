import { DateTime } from "luxon";
import type { AppScreen } from "../../components/app/AppShell";
import type { TripBoardData } from "../trip/use-tripboard-data";
import { isGuideNote } from "../trip/note-sections";

export type SearchData = Pick<TripBoardData, "trip" | "days" | "itinerary" | "notes" | "places" | "bookings" | "checklist" | "accounts" | "budgets" | "financialEvents" | "demoMode">;
export interface SearchField { label: string; value: string }
export interface SearchDocument {
  id: string;
  title: string;
  kind: string;
  date?: string;
  fields: SearchField[];
  href?: string;
  action?: string;
}
export interface SearchResult extends SearchDocument { matches: SearchField[]; score: number }

export const searchScopes: Record<AppScreen, { label: string; hint: string }> = {
  today: { label: "Today", hint: "Today’s activities, day notes, food, bookings, and spending." },
  plan: { label: "Plan", hint: "All days, including activity details, day notes, linked places, and bookings." },
  overview: { label: "Trip at a Glance", hint: "Every day and activity, including details behind the overview." },
  money: { label: "Money", hint: "All transactions, merchants, payment accounts, and budgets." },
  checklist: { label: "Checklist", hint: "All items, descriptions, notes, and linked places." },
  guide: { label: "Trip Guide", hint: "All reference text, phrases, pronunciation, and hotel details." },
  immigration: { label: "Immigration", hint: "All immigration sections, answers, and notes." },
  more: { label: "More", hint: "Places, booking and document records, references, and trip tools." },
  bookings: { label: "Documents & files", hint: "Booking and document details, notes, references, and file names." },
};

export function normalizeSearchText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function hasToken(value: string, token: string) {
  return /^[a-z0-9]$/.test(token) ? new RegExp(`\\b${token}\\b`).test(value) : value.includes(token);
}

function humanLabel(value: string) {
  const label = value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fields(values: Record<string, unknown>, prefix = ""): SearchField[] {
  return Object.entries(values).flatMap(([key, value]): SearchField[] => {
    if (value === undefined || value === null || value === "") return [];
    const label = [prefix, humanLabel(key)].filter(Boolean).join(" · ");
    if (Array.isArray(value)) {
      if (value.every((entry) => typeof entry === "string")) return value.length ? [{ label, value: value.join(" · ") }] : [];
      return value.flatMap((entry, index) => fields(entry, `${label} ${index + 1}`));
    }
    if (typeof value === "object") return fields(value as Record<string, unknown>, label);
    return [{ label, value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value) }];
  });
}

function dateText(date?: string) {
  if (!date) return undefined;
  const parsed = DateTime.fromISO(date);
  return parsed.isValid ? `${date} · ${parsed.toFormat("cccc, d LLLL yyyy")}` : date;
}

export function buildSearchDocuments(data: SearchData, screen: AppScreen, todayDate = data.demoMode ? "2026-12-28" : DateTime.now().setZone(data.trip.timezone).toISODate()!): SearchDocument[] {
  const documents: SearchDocument[] = [];
  const places = new Map(data.places.map((place) => [place.id, place]));
  const bookings = new Map(data.bookings.map((booking) => [booking.id, booking]));
  const checklist = new Map(data.checklist.map((item) => [item.id, item]));
  const days = new Map(data.days.map((day) => [day.date, day]));
  const accounts = new Map(data.accounts.map((account) => [account.id, account.name]));
  const placeFields = (id?: string) => {
    const place = places.get(id ?? "");
    return place ? fields({ place: place.name, address: place.address, neighbourhood: place.neighbourhood, placeNotes: place.notes, openingHours: place.openingHoursNotes }) : [];
  };
  const bookingFields = (id?: string) => {
    const booking = bookings.get(id ?? "");
    return booking ? fields({ booking: booking.title, provider: booking.provider, reference: booking.reference, location: booking.location, bookingNotes: booking.notes, travellers: booking.travellers, files: booking.files.map((file) => file.name) }) : [];
  };
  const onDate = (timestamp?: string) => timestamp ? DateTime.fromISO(timestamp, { zone: data.trip.timezone }).toISODate() ?? undefined : undefined;

  if (["today", "plan", "overview"].includes(screen)) {
    for (const day of data.days) {
      if (screen === "today" && day.date !== todayDate) continue;
      documents.push({ id: `day:${day.id}`, title: day.title, kind: "Travel day", date: day.date, fields: fields({ date: dateText(day.date), notes: day.notes }), href: `/plan?date=${encodeURIComponent(day.date)}`, action: "View day" });
    }
    for (const item of [...data.itinerary].sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence)) {
      if (screen === "today" && item.date !== todayDate) continue;
      const linkedChecklist = checklist.get(item.checklistItemId ?? "");
      documents.push({
        id: `itinerary:${item.id}`, title: item.title, kind: "Activity", date: item.date,
        fields: [
          ...fields({ date: dateText(item.date), day: days.get(item.date)?.title, time: item.plannedStartTime, endTime: item.plannedEndTime, description: item.description, notes: item.notes, transport: item.transportInstructions, details: item.details, priority: item.priority, status: item.status, changeReason: item.changeReason }),
          ...placeFields(item.placeId), ...bookingFields(item.bookingId),
          ...fields({ checklistItem: linkedChecklist?.title, checklistNotes: linkedChecklist?.notes, checklistDescription: linkedChecklist?.description }),
        ],
        href: `/plan?date=${encodeURIComponent(item.date)}&focus=${encodeURIComponent(item.id)}#itinerary-${encodeURIComponent(item.id)}`, action: "View activity in Plan",
      });
    }
  }

  if (["today", "checklist"].includes(screen)) {
    for (const item of data.checklist) {
      if (screen === "today" && item.plannedDay !== todayDate) continue;
      documents.push({ id: `checklist:${item.id}`, title: item.title, kind: "Checklist item", date: item.plannedDay, fields: [...fields({ description: item.description, notes: item.notes, kind: item.kind, priority: item.priority, status: item.status, date: dateText(item.plannedDay), neighbourhood: item.neighbourhood, dietaryWarning: item.dietaryWarning }), ...placeFields(item.linkedPlaceId)], href: `/checklist?kind=${item.kind}`, action: "Open checklist" });
    }
  }

  if (["today", "money"].includes(screen)) {
    for (const event of [...data.financialEvents].reverse()) {
      const date = onDate(event.occurredAt);
      if (screen === "today" && date !== todayDate) continue;
      documents.push({ id: `financial:${event.id}`, title: event.description, kind: "Money activity", date, fields: fields({ merchant: event.merchant, category: event.category, activity: event.type, date: dateText(date), paidFrom: accounts.get(event.sourceAccountId ?? ""), paidTo: accounts.get(event.destinationAccountId ?? ""), sourceAmount: event.sourceAmount && `${event.sourceCurrency ?? ""} ${event.sourceAmount}`, destinationAmount: event.destinationAmount && `${event.destinationCurrency ?? ""} ${event.destinationAmount}`, consumption: event.consumptionAmount && `${event.consumptionCurrency ?? ""} ${event.consumptionAmount}`, estimatedInrAmount: event.estimatedInrAmount, settledInrAmount: event.settledInrAmount, settlementStatus: event.settlementStatus, status: event.voidedAt ? "Voided" : "Active" }), href: "/money#history", action: "Open money history" });
    }
    for (const budget of data.budgets) {
      if (screen === "today" && (budget.scope !== "DAILY" || budget.date !== todayDate)) continue;
      documents.push({ id: `budget:${budget.id}`, title: budget.scope === "TRIP" ? "Whole-trip budget" : budget.scope === "DAILY" ? "Daily budget" : `${budget.category ?? "Category"} budget`, kind: "Budget", date: budget.date, fields: fields({ amount: `${budget.currency} ${budget.amount}`, category: budget.category, scope: budget.scope, date: dateText(budget.date) }), href: "/money#budgets", action: "Open budgets" });
    }
    if (screen === "money") for (const account of data.accounts) {
      documents.push({ id: `account:${account.id}`, title: account.name, kind: "Payment account", fields: fields({ currency: account.currency, type: account.accountType, accountClass: account.accountClass, bank: account.issuingBank, network: account.network, lastFour: account.lastFour, billingCurrency: account.billingCurrency, openingBalance: account.openingBalance, status: account.archivedAt ? "Archived" : "Active" }), href: "/money#accounts", action: "Open payment accounts" });
    }
  }

  if (["today", "more", "bookings"].includes(screen)) {
    for (const booking of data.bookings) {
      const date = onDate(booking.startsAt);
      if (screen === "today" && date !== todayDate) continue;
      documents.push({ id: `booking:${booking.id}`, title: booking.title, kind: "Booking / document", date, fields: [...bookingFields(booking.id), ...fields({ type: booking.type, date: dateText(date), status: booking.status, amount: booking.amount && `${booking.currency ?? ""} ${booking.amount}` })], href: `/bookings?open=${encodeURIComponent(booking.id)}`, action: "Open record" });
    }
  }

  if (["guide", "immigration", "more"].includes(screen)) {
    for (const note of data.notes) {
      const immigration = note.section === "immigration" && note.title !== "Best opening answer";
      if (screen === "immigration" ? !immigration : !isGuideNote(note)) continue;
      documents.push({ id: `note:${note.id}`, title: note.title, kind: immigration ? "Immigration reference" : "Guide reference", fields: fields({ section: note.section, summary: note.summary, notes: note.body, phrase: note.copyText, pronunciation: note.pronunciation, meaning: note.meaning }) });
    }
  }

  if (["more", "guide"].includes(screen)) {
    for (const place of data.places) {
      if (screen === "guide" && !place.category?.toLowerCase().includes("hotel")) continue;
      documents.push({ id: `place:${place.id}`, title: place.name, kind: "Place", fields: [...placeFields(place.id), ...fields({ category: place.category, priority: place.priority })], href: "/more?section=places", action: "Open places" });
    }
  }

  if (screen === "more") {
    for (const [section, title, description] of [
      ["notes", "Trip Guide", "Quick reference, language, transport, payments, and hotel details"],
      ["bookings", "Documents & files", "Bookings, travel records, and private files"],
      ["places", "Places", "Addresses and transport notes"],
      ["alerts", "Trip alerts", "Reminders and notification preferences"],
      ["members", "Trip members", "Access and invitations"],
      ["activity", "Activity history", "Who changed what and when"],
      ["settings", "Trip settings", "Timezone, export trip JSON, password, and account"],
      ["install", "Install TripBoard", "Offline launch and Home Screen access"],
    ]) documents.push({ id: `tool:${section}`, title, kind: "Trip tool", fields: fields({ description }), href: `/more?section=${section}`, action: "Open tool" });
  }
  return documents;
}

export function searchDocuments(documents: SearchDocument[], query: string): SearchResult[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const tokens = [...new Set(normalized.split(" "))];
  return documents.flatMap((document): SearchResult[] => {
    const title = normalizeSearchText(document.title);
    const haystack = [title, normalizeSearchText(document.kind), ...document.fields.map((field) => normalizeSearchText(field.value))].join(" ");
    if (!tokens.every((token) => hasToken(haystack, token))) return [];
    const matches = document.fields.map((field) => {
      const text = normalizeSearchText(field.value);
      const count = tokens.filter((token) => hasToken(text, token)).length;
      return { field, count, score: (text.includes(normalized) ? 100 : 0) + count };
    }).filter((match) => match.count > 0).sort((a, b) => b.score - a.score).map((match) => match.field);
    const score = (title.includes(normalized) ? 100 : 0) + tokens.filter((token) => hasToken(title, token)).length * 10;
    return [{ ...document, matches, score }];
  }).sort((a, b) => b.score - a.score);
}

export function matchExcerpt(value: string, query: string, limit = 240) {
  if (value.length <= limit) return value;
  const normalized = normalizeSearchText(value);
  const positions = normalizeSearchText(query).split(" ").filter(Boolean).map((token) => normalized.indexOf(token)).filter((index) => index >= 0);
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 60);
  return `${start ? "…" : ""}${value.slice(start, start + limit)}${start + limit < value.length ? "…" : ""}`;
}
