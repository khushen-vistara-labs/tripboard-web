export type CurrencyCode = "INR" | "HKD" | "MOP" | (string & {});
export type Priority = "MUST" | "WANT" | "OPTIONAL";
export type ItineraryStatus = "PLANNED" | "COMPLETED" | "SKIPPED" | "MOVED";
export type ChecklistKind = "PLACE" | "FOOD" | "EXPERIENCE" | "SHOPPING" | "OTHER";

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
  baseCurrency: CurrencyCode;
  version?: number;
}

export interface Budget {
  id: string;
  tripId: string;
  amount: string;
  currency: CurrencyCode;
  scope: "TRIP" | "CATEGORY" | "DAILY";
  category?: string;
  date?: string;
  version?: number;
}

export interface ItineraryDay {
  id: string;
  tripId: string;
  date: string;
  title: string;
  notes?: string;
  version?: number;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  address?: string;
  mapsUrl?: string;
  neighbourhood?: string;
  category?: string;
  openingHoursNotes?: string;
  notes?: string;
  expectedDurationMinutes?: number;
  priority: Priority;
  version?: number;
}

export interface Booking {
  id: string;
  tripId: string;
  type: string;
  title: string;
  provider?: string;
  reference?: string;
  startsAt?: string;
  location?: string;
  travellers?: string[];
  amount?: string;
  currency?: CurrencyCode;
  notes?: string;
  status: "PLACEHOLDER" | "CONFIRMED" | "USED" | "CANCELLED";
  files: { id?: string; name: string; kind: string; path?: string }[];
  version?: number;
}

export interface ItineraryItem {
  id: string;
  tripId: string;
  date: string;
  title: string;
  description?: string;
  notes?: string;
  type: "attraction" | "food" | "transport" | "activity" | "booking" | "shopping" | "rest" | "hotel" | "other";
  plannedStartTime?: string;
  plannedEndTime?: string;
  expectedDurationMinutes?: number;
  recommendedDepartureTime?: string;
  priority: Priority;
  status: ItineraryStatus;
  sequence: number;
  completedAt?: string;
  bookingId?: string;
  placeId?: string;
  checklistItemId?: string;
  mapsUrl?: string;
  transportInstructions?: string;
  changeReason?: string;
  version?: number;
}

export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  notes?: string;
  kind: ChecklistKind;
  priority: Priority;
  targetCount: number;
  completedCount: number;
  plannedDay?: string;
  status: "PLANNED" | "COMPLETED" | "SKIPPED";
  neighbourhood?: string;
  dietaryWarning?: string;
  rating?: number;
  favourite?: boolean;
  linkedPlaceId?: string;
  version?: number;
}
