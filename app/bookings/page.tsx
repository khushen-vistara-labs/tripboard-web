import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";
export const metadata: Metadata = { title: "Bookings", description: "Private trip bookings, ticket files, and references." };
export default function BookingsPage() { return <TripBoardApp screen="bookings"/>; }
