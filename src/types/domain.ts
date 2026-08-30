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
}

export interface ItineraryItem {
  id: string;
  tripId: string;
  date: string;
  title: string;
  description?: string;
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
  mapsUrl?: string;
  transportInstructions?: string;
}

export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  description?: string;
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
}
