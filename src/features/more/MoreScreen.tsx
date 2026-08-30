"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BookOpenCheck, CalendarClock, Check, ChevronRight, Cloud, Download, ExternalLink, FileImage, FileText, LogOut, MapPin, Plane, Plus, Settings, Share2, ShieldCheck, Smartphone, Ticket, Upload, Users, Wifi } from "lucide-react";
import type { TripBoardData } from "../trip/use-tripboard-data";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type MoreSection = "overview" | "bookings" | "places" | "alerts" | "members" | "settings" | "install";
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }>; }

const sections: { id: MoreSection; label: string; help: string; icon: typeof Ticket }[] = [
  { id: "bookings", label: "Bookings", help: "Tickets, references, and documents", icon: Ticket },
  { id: "places", label: "Places", help: "Addresses and transport notes", icon: MapPin },
  { id: "alerts", label: "Trip alerts", help: "Reminders and notification preferences", icon: Bell },
  { id: "members", label: "Trip members", help: "Access and invitations", icon: Users },
  { id: "settings", label: "Trip settings", help: "Timezone, export, and account", icon: Settings },
  { id: "install", label: "Install TripBoard", help: "Offline launch and Home Screen access", icon: Smartphone },
];

export function MoreScreen({ data, initialSection }: { data: TripBoardData; initialSection: MoreSection }) {
  const [section, setSection] = useState<MoreSection>(initialSection);
  const [message, setMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  const uploadBookingFile = async (bookingId: string, file: File) => {
    setMessage("");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Choose a PDF, JPEG, PNG, or WebP ticket file."); return; }
    if (file.size > 15 * 1024 * 1024) { setMessage("Booking files must be 15 MB or smaller."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("Connect Supabase before uploading private booking documents."); return; }
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
    const path = `${data.trip.id}/${bookingId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("booking-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setMessage("The booking document could not be uploaded. Try again."); return; }
    const { error: metadataError } = await supabase.from("booking_files").insert({ trip_id: data.trip.id, booking_id: bookingId, storage_path: path, filename: safeName, mime_type: file.type, file_size: file.size });
    if (metadataError) { await supabase.storage.from("booking-documents").remove([path]); setMessage("The booking document could not be saved. Try again."); return; }
    setMessage("Booking document uploaded privately."); await data.refresh();
  };

  const openTicket = async (path?: string) => {
    if (!path) { setMessage("This preview does not include the actual private ticket file."); return; }
    const supabase = getSupabaseBrowserClient(); if (!supabase) { setMessage("Sign in to open this private ticket."); return; }
    const { data: signed, error } = await supabase.storage.from("booking-documents").createSignedUrl(path, 120);
    if (error) { setMessage("The private ticket could not be opened. Try again."); return; }
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  };

  return <>
    <header className="screen-header"><div><p className="eyebrow">TRIP TOOLS</p><h1>{section === "overview" ? "More" : sections.find((item) => item.id === section)?.label}</h1><p>{section === "overview" ? "Bookings, places, alerts, members, and settings." : sections.find((item) => item.id === section)?.help}</p></div>{section !== "overview" && <button className="button secondary" onClick={() => setSection("overview")}>Back to More</button>}</header>
    {message && <div className="notice-banner" role="status">{message}<button onClick={() => setMessage("")}>Dismiss</button></div>}
    {section === "overview" && <Overview onOpen={setSection}/>} 
    {section === "bookings" && <Bookings data={data} onOpenTicket={openTicket} onUpload={uploadBookingFile}/>} 
    {section === "places" && <Places data={data}/>} 
    {section === "alerts" && <Alerts onMessage={setMessage}/>} 
    {section === "members" && <Members data={data}/>} 
    {section === "settings" && <TripSettings data={data} onMessage={setMessage}/>} 
    {section === "install" && <Install installPrompt={installPrompt} onMessage={setMessage}/>} 
  </>;
}

function Overview({ onOpen }: { onOpen: (section: MoreSection) => void }) {
  return <div className="more-grid">{sections.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => onOpen(item.id)}><span className={`more-icon more-${item.id}`}><Icon size={20}/></span><div><strong>{item.label}</strong><p>{item.help}</p></div><ChevronRight size={18}/></button>; })}<article className="security-card"><ShieldCheck size={21}/><div><strong>Private by design</strong><p>Trip records and ticket files are only available to active members.</p></div></article><article className="sync-card"><Cloud size={21}/><div><strong>Everything is synced</strong><p>Offline changes automatically retry when you reconnect.</p></div></article></div>;
}

function Bookings({ data, onOpenTicket, onUpload }: { data: TripBoardData; onOpenTicket: (path?: string) => Promise<void>; onUpload: (bookingId: string, file: File) => Promise<void> }) {
  return <section className="booking-list">{data.bookings.map((booking) => <article className="panel booking-card" key={booking.id}><div className="booking-icon"><Plane size={21}/></div><div className="booking-main"><div className="booking-title"><span>{booking.type}</span><h2>{booking.title}</h2><p>{booking.provider}</p></div><div className="booking-details"><span><CalendarClock size={15}/>{booking.startsAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: data.trip.timezone }).format(new Date(booking.startsAt)) : "Date to be confirmed"}</span><span><BookOpenCheck size={15}/>Reference <b>{booking.reference || "Not added"}</b></span></div><div className="booking-files">{booking.files.map((file) => <button key={file.name} onClick={() => void onOpenTicket(file.path)}><span>{file.kind === "PDF" ? <FileText size={16}/> : <FileImage size={16}/>}</span><div><strong>{file.name}</strong><small>Private document</small></div><ExternalLink size={15}/></button>)}{booking.files.length === 0 && <p className="mini-empty">No ticket file uploaded yet.</p>}</div></div><div className="booking-actions"><span className={`booking-status status-${booking.status.toLowerCase()}`}><Check size={13}/>{booking.status}</span><label className="button secondary upload-button"><Upload size={15}/> Upload<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(booking.id, file); }}/></label></div></article>)}</section>;
}

function Places({ data }: { data: TripBoardData }) {
  const [search, setSearch] = useState("");
  const places = data.places.filter((place) => `${place.name} ${place.neighbourhood}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="panel places-panel"><label className="search-field"><MapPin size={16}/><span className="sr-only">Search places</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search places or neighbourhoods"/></label><div className="places-list">{places.map((place) => <article key={place.id}><span className="place-pin"><MapPin size={17}/></span><div><div><h2>{place.name}</h2><span className={`priority-badge ${place.priority.toLowerCase()}`}>{place.priority}</span></div><p>{place.category} · {place.neighbourhood}</p><address>{place.address}</address></div>{place.mapsUrl && <a className="button secondary" target="_blank" rel="noreferrer" href={place.mapsUrl}><ExternalLink size={15}/> Directions</a>}</article>)}</div></section>;
}

function Alerts({ onMessage }: { onMessage: (message: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState({ morning: true, leave: true, overdue: true, budget: true, booking: true, wallet: false });
  const enable = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) { onMessage("Push is not supported here. In-app alerts will still work."); return; }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { onMessage("Notification permission was not granted. In-app alerts remain available."); return; }
    const client = getSupabaseBrowserClient();
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!client || !publicKey) { setEnabled(true); onMessage("Visible browser alerts are allowed. Connect Supabase and a VAPID public key to enable remote trip push."); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) as BufferSource });
      const json = subscription.toJSON(); const { data: userData } = await client.auth.getUser();
      if (!userData.user || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Push subscription is incomplete");
      const { error } = await client.from("push_subscriptions").upsert({ user_id: userData.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, device_label: navigator.platform || "Web device", last_used_at: new Date().toISOString() }, { onConflict: "endpoint" });
      if (error) throw error;
      setEnabled(true); onMessage("Trip alerts are enabled on this device.");
    } catch { onMessage("Browser permission is enabled, but this device could not be registered for remote push. In-app alerts still work."); }
  };
  const rows = [{ key: "morning", title: "Morning summary", help: "Today’s plan and first departure" }, { key: "leave", title: "Leave soon", help: "A practical departure reminder" }, { key: "overdue", title: "Overdue items", help: "Actions that still need a decision" }, { key: "budget", title: "Budget warnings", help: "One alert at 80% and 100%" }, { key: "booking", title: "Booking reminders", help: "Tickets when you need them" }, { key: "wallet", title: "Low wallet", help: "Optional Octopus and cash alerts" }] as const;
  return <div className="settings-grid"><section className="panel alert-enable"><span className="alert-hero-icon"><BellRing size={24}/></span><div><h2>{enabled ? "Trip alerts enabled" : "Enable trip alerts"}</h2><p>Get timely departures, booking reminders, and end-of-day reviews on this device.</p></div><button className="button primary" onClick={() => void enable()} disabled={enabled}>{enabled ? <><Check size={16}/> Enabled</> : "Enable alerts"}</button></section><section className="panel preference-list"><h2>Alert preferences</h2>{rows.map((row) => <label key={row.key}><div><strong>{row.title}</strong><p>{row.help}</p></div><input type="checkbox" checked={preferences[row.key]} onChange={(event) => setPreferences((value) => ({...value, [row.key]: event.target.checked}))}/><span className="toggle"/></label>)}</section></div>;
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function Members({ data }: { data: TripBoardData }) {
  return <div className="settings-grid"><section className="panel member-list"><div className="panel-heading"><div><h2>Travelling together</h2><p>Completion and spending stay trip-level.</p></div><button className="button primary"><Plus size={15}/> Invite traveller</button></div><article><span className="member-avatar owner">H</span><div><strong>Harshith</strong><p>Owner · You</p></div><span>Active</span></article><article><span className="member-avatar">P</span><div><strong>Travel partner</strong><p>Member</p></div><span>Active</span></article></section><section className="panel shared-principle"><Users size={22}/><h2>One shared trip</h2><p>People have separate sign-ins for secure access and sync. The itinerary, checklist, and finances belong to {data.trip.name} as a whole.</p></section></div>;
}

function TripSettings({ data, onMessage }: { data: TripBoardData; onMessage: (message: string) => void }) {
  const logout = async () => { const client = getSupabaseBrowserClient(); if (client) await client.auth.signOut(); window.location.href = "/login"; };
  const exportTrip = () => {
    const blob = new Blob([JSON.stringify({ trip: data.trip, itinerary: data.itinerary, checklist: data.checklist, places: data.places, bookings: data.bookings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "tripboard-export.json"; link.click(); URL.revokeObjectURL(url); onMessage("Trip export downloaded.");
  };
  return <div className="settings-grid"><section className="panel settings-form"><h2>Trip configuration</h2><label>Trip name<input defaultValue={data.trip.name}/></label><label>Trip timezone<select defaultValue={data.trip.timezone}><option value="Asia/Hong_Kong">Asia/Hong_Kong</option></select><small>Schedules and alerts always use the trip timezone.</small></label><label>Base currency<select defaultValue={data.trip.baseCurrency}><option>INR</option><option>HKD</option></select></label><button className="button primary">Save settings</button></section><section className="panel account-tools"><h2>Your data</h2><button onClick={exportTrip}><Download size={17}/><div><strong>Export trip JSON</strong><p>Download itinerary, checklist, places, and bookings.</p></div><ChevronRight size={17}/></button><button onClick={() => void logout()}><LogOut size={17}/><div><strong>Log out</strong><p>Remove this account’s session from this device.</p></div><ChevronRight size={17}/></button></section></div>;
}

function Install({ installPrompt, onMessage }: { installPrompt: InstallPromptEvent | null; onMessage: (message: string) => void }) {
  const install = async () => { if (installPrompt) { await installPrompt.prompt(); const choice = await installPrompt.userChoice; onMessage(choice.outcome === "accepted" ? "TripBoard was added to this device." : "Install dismissed. You can return here anytime."); } else onMessage("Open your browser’s Share or menu controls, then choose Add to Home Screen."); };
  return <div className="install-layout"><section className="install-hero panel"><span><Smartphone size={31}/></span><h2>Keep TripBoard one tap away</h2><p>Install the private PWA for a fast app-like launch, cached trip details, and supported trip alerts.</p><button className="button primary" onClick={() => void install()}><Download size={17}/> Add to Home Screen</button></section><section className="panel install-benefits"><article><Wifi size={20}/><div><strong>Useful offline</strong><p>See itinerary, addresses, notes, balances, and recent history without a connection.</p></div></article><article><Bell size={20}/><div><strong>Timely alerts</strong><p>Home Screen web apps can receive trip reminders where standards-based push is supported.</p></div></article><article><Share2 size={20}/><div><strong>Normal browser URLs</strong><p>Every screen still works from a regular link—installation is optional.</p></div></article></section></div>;
}
