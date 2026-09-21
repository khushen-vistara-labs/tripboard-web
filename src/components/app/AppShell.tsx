"use client";

import type { ReactNode } from "react";
import { BookOpenText, CalendarDays, CheckSquare2, CircleDollarSign, Cloud, CloudOff, Ellipsis, House, MapPinned, Plane, ShieldCheck, Sparkles } from "lucide-react";
import { DateTime } from "luxon";
import type { Trip } from "../../types/domain";
import { ThemeToggle } from "../ui/ThemeToggle";

export type AppScreen = "today" | "plan" | "overview" | "money" | "checklist" | "guide" | "immigration" | "more" | "bookings";

const nav = [
  { id: "today", label: "Today", compactLabel: "Today", href: "/today", icon: House },
  { id: "plan", label: "Plan", compactLabel: "Plan", href: "/plan", icon: CalendarDays },
  { id: "overview", label: "Trip at a Glance", compactLabel: "Overview", href: "/overview", icon: MapPinned },
  { id: "money", label: "Money", compactLabel: "Money", href: "/money", icon: CircleDollarSign },
  { id: "checklist", label: "Checklist", compactLabel: "List", href: "/checklist", icon: CheckSquare2 },
  { id: "immigration", label: "Immigration", compactLabel: "Entry", href: "/immigration", icon: ShieldCheck },
  { id: "guide", label: "Trip Guide", compactLabel: "Guide", href: "/guide", icon: BookOpenText },
  { id: "more", label: "More", compactLabel: "More", href: "/more", icon: Ellipsis },
] as const;

function formatTripDates(trip: Trip) {
  if (!trip.startDate || !trip.endDate) return "";
  const start = DateTime.fromISO(trip.startDate, { zone: "utc" });
  const end = DateTime.fromISO(trip.endDate, { zone: "utc" });
  return start.year === end.year
    ? `${start.toFormat("LLL d")} – ${end.toFormat("LLL d")}`
    : `${start.toFormat("LLL d, yyyy")} – ${end.toFormat("LLL d, yyyy")}`;
}

export function AppShell({ screen, trip, demoMode, online, children }: { screen: AppScreen; trip: Trip; demoMode: boolean; online: boolean; children: ReactNode }) {
  const active = screen === "bookings" ? "more" : screen;
  return <main className="app-shell">
    <aside className="sidebar" aria-label="Primary navigation">
      <a href="/today" className="brand" aria-label="TripBoard home"><span className="brand-mark"><Plane size={17}/></span><span>TripBoard</span></a>
      <nav className="side-nav">
        {nav.map((item) => { const Icon = item.icon; return <a key={item.id} className={active === item.id ? "active" : ""} href={item.href}><Icon size={18}/><span>{item.label}</span></a>; })}
      </nav>
      <div className="sidebar-trip">
        <span className="eyebrow">CURRENT TRIP</span>
        <strong>{trip.name}</strong>
        <span>{formatTripDates(trip)}</span>
      </div>
      <div className={`side-sync ${online ? "online" : "offline"}`}>{online ? <Cloud size={14}/> : <CloudOff size={14}/>}<span>{online ? "Synced" : "Offline"}</span></div>
      <ThemeToggle />
    </aside>

    <section className="app-content">
      {demoMode && <div className="demo-banner"><Sparkles size={14}/><span>Preview data</span><span>Connect Supabase to use your private shared trip.</span><a href="/login">Set up →</a></div>}
      {!online && <div className="offline-banner"><CloudOff size={15}/> You’re offline. Changes stay on this device and sync when your connection returns.</div>}
      <div className="mobile-theme-control"><ThemeToggle className="mobile-theme-toggle" /></div>
      {children}
    </section>

    <nav className="bottom-nav" aria-label="Primary navigation">
      {nav.filter((item) => item.id !== "overview").map((item) => { const Icon = item.icon; return <a key={item.id} className={active === item.id ? "active" : ""} href={item.href} aria-label={item.label}><Icon size={20}/><span className="bottom-nav-label"><span className="bottom-nav-label-full">{item.label}</span><span className="bottom-nav-label-compact">{item.compactLabel}</span></span></a>; })}
    </nav>
  </main>;
}
