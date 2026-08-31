/** Format a duration compactly for the trip UI. */
export function formatDuration(minutes: number): string {
  if (minutes <= 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} ${hours === 1 ? "hr" : "hrs"} ${remainder} min` : `${hours} ${hours === 1 ? "hr" : "hrs"}`;
}
