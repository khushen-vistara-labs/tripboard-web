import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";
export const metadata: Metadata = { title: "Checklist", description: "Shared places, food, experiences, and must-do progress." };
export default function ChecklistPage() { return <TripBoardApp screen="checklist"/>; }
