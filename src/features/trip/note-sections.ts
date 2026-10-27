import type { TripNote } from "../../types/domain";

export function isGuideNote(note: TripNote) {
  return !note.section.toLowerCase().includes("culture")
    && !note.section.toLowerCase().includes("immigration")
    && !note.title.toLowerCase().includes("pre-trip");
}
