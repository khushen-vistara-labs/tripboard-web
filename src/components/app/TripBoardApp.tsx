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
import { discardMutation, retryMutation } from "../../lib/offline/queue";
import { offlineDb, type OfflineMutation } from "../../lib/offline/db";
import { mutationSummary } from "../../lib/offline/conflicts";
import { Modal } from "../ui/Modal";

export function TripBoardApp({ screen }: { screen: AppScreen }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2 } } }));
  return <QueryClientProvider client={queryClient}><TripBoardInner screen={screen}/></QueryClientProvider>;
}

function TripBoardInner({ screen }: { screen: AppScreen }) {
  const data = useTripBoardData();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [queued, setQueued] = useState<OfflineMutation[]>([]);
  useEffect(() => {
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
  useEffect(() => {
    const reload = () => { void offlineDb.mutations.toArray().then(setQueued).catch(() => setQueued([])); };
    reload();
    const timer = window.setInterval(reload, 1500);
    return () => window.clearInterval(timer);
  }, []);

  if (data.loading) return <div className="loading-screen"><span className="brand-mark"><span>✈</span></span><h1>Opening your trip…</h1><p>Bringing today’s plan and offline copy up to date.</p></div>;
  if (data.authRequired) return <div className="auth-gate"><span className="brand-mark">T</span><h1>Your shared trip is private</h1><p>Sign in with the invited email address to continue.</p><a className="button primary" href="/login">Sign in</a></div>;
  if (!data.dataAvailable) return <NewTripSetup data={data}/>;

  return <AppShell screen={screen} trip={data.trip} demoMode={data.demoMode} online={online}>
    <SyncState online={online} queued={queued} onRetry={async (id) => { await retryMutation(id); window.dispatchEvent(new Event("tripboard:sync")); }} onDiscard={async (id) => { await discardMutation(id); await data.refresh(); }}/>
    {data.error && <div className="error-banner" role="status">{data.error}<button onClick={() => void data.refresh()}>Retry</button></div>}
    {screen === "today" && <TodayScreen data={data}/>} 
    {screen === "plan" && <PlanScreen data={data}/>} 
    {screen === "money" && <MoneyScreen data={data}/>} 
    {screen === "checklist" && <ChecklistScreen data={data}/>} 
    {(screen === "more" || screen === "bookings") && <MoreScreen data={data} initialSection={screen === "bookings" ? "bookings" : "overview"}/>} 
  </AppShell>;
}

function NewTripSetup({ data }: { data: ReturnType<typeof useTripBoardData> }) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);
  return <main className="trip-setup"><section className="panel setup-card"><span className="brand-mark">T</span><p className="eyebrow">START A SHARED TRIP</p><h1>Create your trip</h1><p>You’ll be the owner. TripBoard creates every travel day now, and you can invite people afterwards.</p><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await data.createTrip({ name, startDate, endDate, timezone, baseCurrency }); setSaving(false); }}><label>Trip name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Hong Kong + Macau" maxLength={120} required/></label><div className="form-grid"><label>Start date<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} required/></label><label>End date<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required/></label></div><div className="form-grid"><label>Trip timezone<input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Hong_Kong" required/><small className="field-help">Use an IANA timezone such as Asia/Hong_Kong.</small></label><label>Base currency<select value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)}><option>INR</option><option>HKD</option><option>MOP</option><option>USD</option><option>EUR</option><option>GBP</option></select></label></div>{data.error && !data.error.startsWith("No trip") && <div className="form-error" role="alert">{data.error}</div>}<button className="button primary full" disabled={saving}>{saving ? "Creating your trip…" : "Create shared trip"}</button></form></section></main>;
}

function SyncState({ online, queued, onRetry, onDiscard }: { online: boolean; queued: OfflineMutation[]; onRetry: (id: string) => Promise<void>; onDiscard: (id: string) => Promise<void> }) {
  const [reviewing, setReviewing] = useState(false);
  if (!online) return <div className="sync-banner" role="status">Offline · changes will sync when you reconnect.</div>;
  const conflict = queued.find((item) => item.status === "CONFLICT");
  const failed = queued.find((item) => item.status === "FAILED");
  const pending = queued.find((item) => item.status === "PENDING" || item.status === "SYNCING");
  const item = conflict ?? failed;
  if (item) return <><div className="sync-banner sync-problem" role="status">{conflict ? "Conflict needs review." : "Sync failed."}<button onClick={() => setReviewing(true)}>Review {queued.filter((entry) => entry.status === "CONFLICT" || entry.status === "FAILED").length} change{queued.filter((entry) => entry.status === "CONFLICT" || entry.status === "FAILED").length === 1 ? "" : "s"}</button></div>{reviewing && <SyncReviewModal mutations={queued.filter((entry) => entry.status === "CONFLICT" || entry.status === "FAILED")} onClose={() => setReviewing(false)} onRetry={onRetry} onDiscard={onDiscard}/>}</>;
  if (pending) return <div className="sync-banner" role="status">Saving · {queued.length} pending change{queued.length === 1 ? "" : "s"}.</div>;
  return <div className="sync-banner saved" role="status">Saved</div>;
}

function SyncReviewModal({ mutations, onClose, onRetry, onDiscard }: { mutations: OfflineMutation[]; onClose: () => void; onRetry: (id: string) => Promise<void>; onDiscard: (id: string) => Promise<void> }) {
  return <Modal title="Review pending changes" description="Retry after checking the latest shared version, or discard to restore the last server copy." onClose={onClose} wide><div className="sync-review-list">{mutations.map((mutation) => <article key={mutation.id}><div><span className={`sync-status ${mutation.status.toLowerCase()}`}>{mutation.status === "CONFLICT" ? "Conflict" : "Failed"}</span><strong>{mutationSummary(mutation.entity, mutation.command)}</strong><p>{mutation.lastError || "The server did not accept this change."}</p><small>Created {new Date(mutation.createdAt).toLocaleString()} · {mutation.attempts} attempt{mutation.attempts === 1 ? "" : "s"}</small></div><details><summary>Change details</summary><pre>{safeMutationDetails(mutation.payload)}</pre></details><div className="sync-review-actions"><button className="button secondary" onClick={() => void onRetry(mutation.id)}>Retry</button><button className="button danger" onClick={() => void onDiscard(mutation.id)}>Discard and restore</button></div></article>)}</div>{mutations.length === 0 && <div className="mini-empty">No changes need review.</div>}</Modal>;
}

function safeMutationDetails(payload: Record<string, unknown>) {
  return JSON.stringify(payload, (_key, value) => value instanceof Blob ? `[File: ${value.size} bytes]` : value, 2);
}
