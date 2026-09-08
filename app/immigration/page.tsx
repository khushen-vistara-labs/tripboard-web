import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";

export const metadata: Metadata = {
  title: "Immigration",
  description: "A shared, editable immigration reference for your trip.",
};

export default function ImmigrationPage() { return <TripBoardApp screen="immigration"/>; }
