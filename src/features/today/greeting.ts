export function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return { text: "Good morning", glyph: "☀" };
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", glyph: "☀" };
  return { text: "Good evening", glyph: "☾" };
}
