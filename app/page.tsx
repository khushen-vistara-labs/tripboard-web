import type { Metadata } from "next";
import { TripBoardApp } from "../src/components/app/TripBoardApp";

export const metadata: Metadata = { title: "Today", description: "Today’s shared trip plan, progress, and money at a glance." };
export default function Home() { return <TripBoardApp screen="today"/>; }
