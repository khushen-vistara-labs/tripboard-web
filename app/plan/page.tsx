import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";
export const metadata: Metadata = { title: "Plan", description: "The shared day-by-day TripBoard itinerary." };
export default function PlanPage() { return <TripBoardApp screen="plan"/>; }
