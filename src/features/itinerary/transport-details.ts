import type { ItineraryDetails, TransportOption } from "../../types/domain";

/** Normalizes older stored transport records without inventing any itinerary data. */
export function normalizeItineraryDetails(value: unknown): ItineraryDetails | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { transportOptions: rawOptions, recommended: rawRecommended, ...rest } = value as Record<string, unknown>;
  const transportOptions = Array.isArray(rawOptions) ? rawOptions.flatMap((raw): TransportOption[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const option = raw as Record<string, unknown>;
    const name = typeof option.name === "string" ? option.name : typeof option.label === "string" ? option.label : undefined;
    const route = typeof option.route === "string" ? option.route : typeof option.instructions === "string" ? option.instructions : undefined;
    const approxDurationMinutes = typeof option.approxDurationMinutes === "number" ? option.approxDurationMinutes : typeof option.durationMinutes === "number" ? option.durationMinutes : undefined;
    const approxCost = typeof option.approxCost === "string" ? option.approxCost : typeof option.cost === "string" ? option.cost : undefined;
    if (!name || !route) return [];
    return [{ name, route, ...(approxDurationMinutes === undefined ? {} : { approxDurationMinutes }), ...(approxCost === undefined ? {} : { approxCost }), ...(typeof option.notes === "string" ? { notes: option.notes } : {}) }];
  }) : [];
  const legacyRecommended = Array.isArray(rawOptions) ? rawOptions.find((raw) => raw && typeof raw === "object" && !Array.isArray(raw) && (raw as Record<string, unknown>).mode === "recommended") as Record<string, unknown> | undefined : undefined;
  const recommended = typeof rawRecommended === "string" ? rawRecommended : typeof legacyRecommended?.name === "string" ? legacyRecommended.name : typeof legacyRecommended?.label === "string" ? legacyRecommended.label : undefined;
  return { ...rest, ...(transportOptions.length ? { transportOptions } : {}), ...(recommended ? { recommended } : {}) } as ItineraryDetails;
}
