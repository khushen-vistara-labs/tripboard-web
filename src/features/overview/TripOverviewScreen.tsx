"use client";

import { ExternalLink, MapPinned } from "lucide-react";
import { DateTime } from "luxon";
import { useMemo } from "react";
import type { ItineraryItem } from "../../types/domain";
import type { TripBoardData } from "../trip/use-tripboard-data";

type OverviewStop = Pick<ItineraryItem, "id" | "title" | "priority" | "placeId">;

function shortDayTheme(title: string) {
  const themes = title.split("•").map((theme) => theme.trim()).filter(Boolean);
  return themes.slice(0, 3).join(" · ") || "Trip day";
}

function shortStopName(title: string) {
  const names: Record<string, string> = {
    "Luk On Kui old-school dim sum": "Luk On Kui dim sum",
    "Sham Shui Po exploration": "Sham Shui Po",
    "Mong Kok markets and streets": "Mong Kok",
    "Temple Street Night Market": "Temple Street",
    "Hing Kee Claypot Rice": "Hing Kee",
    "Kai Kai Dessert": "Kai Kai",
  };
  return names[title] ?? title;
}

function majorStops(items: ItineraryItem[]) {
  const planned = items.filter((item) => item.status !== "SKIPPED").sort((a, b) => a.sequence - b.sequence);
  const activities = planned.filter((item) => item.type !== "transport");
  return (activities.length ? activities : planned) as OverviewStop[];
}

function routeUrl(stops: OverviewStop[], placeNames: Map<string, string>) {
  const locations = stops.map((stop) => placeNames.get(stop.placeId ?? "") ?? stop.title);
  if (locations.length < 2) return undefined;
  const params = new URLSearchParams({ api: "1", origin: locations[0], destination: locations.at(-1)!, travelmode: "transit" });
  if (locations.length > 2) params.set("waypoints", locations.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function TripOverviewScreen({ data }: { data: TripBoardData }) {
  const days = useMemo(() => [...new Set([...data.days.map((day) => day.date), ...data.itinerary.map((item) => item.date)])].sort(), [data.days, data.itinerary]);
  const placeNames = useMemo(() => new Map(data.places.map((place) => [place.id, place.name])), [data.places]);

  return <>
    <header className="screen-header overview-header">
      <div><p className="eyebrow">ONE-SHOT TRIP VIEW</p><h1>Trip at a Glance</h1><p>Every day, in order — without the detail overload.</p></div>
      <span className="overview-count">{days.length} days</span>
    </header>

    <section className="glance-list" aria-label="Complete trip overview">
      {days.map((date, index) => {
        const day = data.days.find((entry) => entry.date === date);
        const stops = majorStops(data.itinerary.filter((item) => item.date === date));
        const mapUrl = routeUrl(stops, placeNames);
        return <article className="glance-day panel" key={date}>
          <div className="glance-day-heading">
            <div className="glance-date"><span>DAY {index + 1}</span><strong>{DateTime.fromISO(date).toFormat("d LLL")}</strong><small>{DateTime.fromISO(date).toFormat("cccc")}</small></div>
            <div><h2>{shortDayTheme(day?.title ?? "Trip day")}</h2><p>{stops.length ? `${stops.length} main stop${stops.length === 1 ? "" : "s"}` : "Plan still taking shape"}</p></div>
            {mapUrl && <a className="glance-map-link" href={mapUrl} target="_blank" rel="noreferrer"><MapPinned size={16}/><span>Route in Maps</span><ExternalLink size={13}/></a>}
          </div>
          {stops.length ? <ol className="glance-route">
            {stops.map((stop, stopIndex) => <li key={stop.id}>
              <span className="glance-stop-number">{stopIndex + 1}</span>
              <span className="glance-stop-name">{shortStopName(stop.title)}</span>
              {stop.priority === "MUST" && <span className="glance-must">MUST</span>}
            </li>)}
          </ol> : <p className="glance-empty">No planned places or activities yet.</p>}
        </article>;
      })}
    </section>
  </>;
}
