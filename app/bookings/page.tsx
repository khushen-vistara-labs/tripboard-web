import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";
export const metadata: Metadata = { title: "Documents & files", description: "Private travel bookings, documents, and important files." };
export default function BookingsPage() { return <TripBoardApp screen="bookings"/>; }
