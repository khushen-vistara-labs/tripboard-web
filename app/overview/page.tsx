import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";

export const metadata: Metadata = { title: "Trip at a Glance", description: "A one-shot overview of every day and major stop on the trip." };

export default function OverviewPage() { return <TripBoardApp screen="overview"/>; }
