"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppScreen } from "./AppShell";
import { AppShell } from "./AppShell";
import { useTripBoardData } from "../../features/trip/use-tripboard-data";
import { TodayScreen } from "../../features/today/TodayScreen";
import { PlanScreen } from "../../features/itinerary/PlanScreen";
import { MoneyScreen } from "../../features/money/MoneyScreen";
import { ChecklistScreen } from "../../features/checklist/ChecklistScreen";
import { MoreScreen } from "../../features/more/MoreScreen";

export function TripBoardApp({ screen }: { screen: AppScreen }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2 } } }));
  return <QueryClientProvider client={queryClient}><TripBoardInner screen={screen}/></QueryClientProvider>;
}

function TripBoardInner({ screen }: { screen: AppScreen }) {
  const data = useTripBoardData();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true); const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline); window.addEventListener("offline", goOffline);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        // A PWA cache must never pin Vite's changing development modules.
        void navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        );
      } else {
        void navigator.serviceWorker.register("/sw.js");
      }
    }
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  if (data.loading) return <div className="loading-screen"><span className="brand-mark"><span>✈</span></span><h1>Opening your trip…</h1><p>Bringing today’s plan and offline copy up to date.</p></div>;
  if (data.authRequired) return <div className="auth-gate"><span className="brand-mark">T</span><h1>Your shared trip is private</h1><p>Sign in with the invited email address to continue.</p><a className="button primary" href="/login">Sign in with email code</a></div>;
  if (!data.dataAvailable) return <div className="auth-gate"><span className="brand-mark">T</span><h1>Your trip isn’t available</h1><p>{data.error ?? "Try again when your connection improves."}</p><button className="button primary" onClick={() => void data.refresh()}>Try again</button></div>;

  return <AppShell screen={screen} trip={data.trip} demoMode={data.demoMode} online={online}>
    {data.error && <div className="error-banner" role="status">{data.error}<button onClick={() => void data.refresh()}>Retry</button></div>}
    {screen === "today" && <TodayScreen data={data}/>} 
    {screen === "plan" && <PlanScreen data={data}/>} 
    {screen === "money" && <MoneyScreen data={data}/>} 
    {screen === "checklist" && <ChecklistScreen data={data}/>} 
    {(screen === "more" || screen === "bookings") && <MoreScreen data={data} initialSection={screen === "bookings" ? "bookings" : "overview"}/>} 
  </AppShell>;
}
