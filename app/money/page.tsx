import type { Metadata } from "next";
import { TripBoardApp } from "../../src/components/app/TripBoardApp";
export const metadata: Metadata = { title: "Money", description: "Trip funding, local consumption, budgets, and stored-value balances without double-counting." };
export default function MoneyPage() { return <TripBoardApp screen="money"/>; }
