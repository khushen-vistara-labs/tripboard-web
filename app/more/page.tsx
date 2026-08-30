import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";
export const metadata: Metadata = { title: "More", description: "Bookings, places, alerts, trip members, installation, and settings." };
export default function MorePage() { return <TripBoardApp screen="more"/>; }
