"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, BookOpenCheck, CalendarClock, Check, ChevronRight, Cloud, Copy, Download, ExternalLink, FileImage, FileText, History, LockKeyhole, LogOut, MapPin, Pencil, Plane, Plus, RefreshCw, Settings, Share2, ShieldCheck, Smartphone, StickyNote, Ticket, Trash2, Upload, UserMinus, Users, Wifi, XCircle } from "lucide-react";
import type { TripBoardData } from "../trip/use-tripboard-data";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { Modal } from "../../components/ui/Modal";
import { enqueueMutation } from "../../lib/offline/queue";
import type { Booking, Place, Priority, TripNote } from "../../types/domain";
import { formatDuration } from "../../lib/dates/duration";

type MoreSection = "overview" | "notes" | "bookings" | "places" | "alerts" | "members" | "activity" | "settings" | "install";
export interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }>; }

const sections: { id: MoreSection; label: string; help: string; icon: typeof Ticket }[] = [
  { id: "notes", label: "Trip Guide", help: "Quick reference for the moments you need it", icon: StickyNote },
  { id: "bookings", label: "Bookings", help: "Tickets, references, and documents", icon: Ticket },
  { id: "places", label: "Places", help: "Addresses and transport notes", icon: MapPin },
  { id: "alerts", label: "Trip alerts", help: "Reminders and notification preferences", icon: Bell },
  { id: "members", label: "Trip members", help: "Access and invitations", icon: Users },
  { id: "activity", label: "Activity history", help: "Who changed what and when", icon: History },
  { id: "settings", label: "Trip settings", help: "Timezone, export, and account", icon: Settings },
  { id: "install", label: "Install TripBoard", help: "Offline launch and Home Screen access", icon: Smartphone },
];

export function MoreScreen({ data, initialSection, installPrompt }: { data: TripBoardData; initialSection: MoreSection; installPrompt: InstallPromptEvent | null }) {
  const [section, setSection] = useState<MoreSection>(initialSection);
  const [message, setMessage] = useState("");
  useEffect(() => {
    queueMicrotask(() => { const requested = new URLSearchParams(window.location.search).get("section") as MoreSection | null; if (requested && sections.some((item) => item.id === requested)) setSection(requested); });
  }, []);

  const uploadBookingFile = async (bookingId: string, file: File) => {
    setMessage("");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Choose a PDF, JPEG, PNG, or WebP ticket file."); return; }
    if (file.size > 15 * 1024 * 1024) { setMessage("Booking files must be 15 MB or smaller."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("Connect Supabase before uploading private booking documents."); return; }
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
    const id = crypto.randomUUID(); const path = `${data.trip.id}/${bookingId}/${id}-${safeName}`;
    if (!navigator.onLine) { await enqueueMutation({ tripId: data.trip.id, entity: "booking-file", command: "upload", payload: { id, bookingId, path, filename: safeName, mimeType: file.type, fileSize: file.size, file } }); setMessage("Booking document saved on this device and queued for upload."); return; }
    const { error: uploadError } = await supabase.storage.from("booking-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setMessage("The booking document could not be uploaded. Try again."); return; }
    const { error: metadataError } = await supabase.from("booking_files").insert({ id, trip_id: data.trip.id, booking_id: bookingId, storage_path: path, filename: safeName, mime_type: file.type, file_size: file.size });
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
  const deleteBookingFile = async (file: { id?: string; path?: string }) => {
    if (!file.id || !file.path || !window.confirm("Delete this private booking file?")) return;
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    if (!navigator.onLine) { await enqueueMutation({ tripId: data.trip.id, entity: "booking-file", command: "delete", payload: { fileId: file.id, path: file.path } }); setMessage("File deletion queued until you reconnect."); return; }
    const { error: storageError } = await supabase.storage.from("booking-documents").remove([file.path]);
    if (storageError) { setMessage("The private booking file could not be deleted."); return; }
    const { error: metadataError } = await supabase.rpc("delete_booking_file_metadata", { p_file_id: file.id });
    if (metadataError) { setMessage("The file was removed but its record needs cleanup. Refresh before uploading it again."); return; }
    setMessage("Private booking file deleted."); await data.refresh();
  };
  const replaceBookingFile = async (bookingId: string, oldFile: { id?: string; path?: string }, file: File) => {
    if (!oldFile.id || !oldFile.path) return; if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { setMessage("Choose a PDF, JPEG, PNG, or WebP file up to 15 MB."); return; }
    const supabase = getSupabaseBrowserClient(); if (!supabase) return; const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-"); const id = crypto.randomUUID(); const path = `${data.trip.id}/${bookingId}/${id}-${safeName}`;
    if (!navigator.onLine) { await enqueueMutation({ tripId: data.trip.id, entity: "booking-file", command: "replace", payload: { id, bookingId, path, filename: safeName, mimeType: file.type, fileSize: file.size, file, oldFileId: oldFile.id, oldPath: oldFile.path } }); setMessage("Replacement saved locally and queued until you reconnect."); return; }
    const { error: uploadError } = await supabase.storage.from("booking-documents").upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) { setMessage("The replacement file could not be uploaded."); return; }
    const { error: metadataError } = await supabase.from("booking_files").insert({ id, trip_id: data.trip.id, booking_id: bookingId, storage_path: path, filename: safeName, mime_type: file.type, file_size: file.size }); if (metadataError) { await supabase.storage.from("booking-documents").remove([path]); setMessage("The replacement file could not be saved."); return; }
    const { error: oldStorageError } = await supabase.storage.from("booking-documents").remove([oldFile.path]); if (oldStorageError) { setMessage("The new file is ready, but the old file could not be cleaned up."); await data.refresh(); return; }
    const { error: oldMetadataError } = await supabase.rpc("delete_booking_file_metadata", { p_file_id: oldFile.id }); if (oldMetadataError) { setMessage("The file was replaced, but old metadata needs cleanup."); await data.refresh(); return; }
    setMessage("Booking file replaced safely."); await data.refresh();
  };
  const deleteBookingSafely = async (booking: Booking) => {
    if (!window.confirm(`Delete “${booking.title}” and its ${booking.files.length} private file${booking.files.length === 1 ? "" : "s"}?`)) return;
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    if (!navigator.onLine) { for (const file of booking.files) if (file.id && file.path) await enqueueMutation({ tripId: data.trip.id, entity: "booking-file", command: "delete", payload: { fileId: file.id, path: file.path } }); await data.deleteBooking(booking.id); setMessage("Booking deletion queued until you reconnect."); return; }
    const paths = booking.files.flatMap((file) => file.path ? [file.path] : []); if (paths.length) { const { error: cleanupError } = await supabase.storage.from("booking-documents").remove(paths); if (cleanupError) { setMessage("Private files could not be cleaned up, so the booking was kept."); return; } }
    await data.deleteBooking(booking.id); setMessage("Booking and private files deleted.");
  };

  return <>
    <header className="screen-header"><div><p className="eyebrow">TRIP TOOLS</p><h1>{section === "overview" ? "More" : sections.find((item) => item.id === section)?.label}</h1><p>{section === "overview" ? "Bookings, places, alerts, members, and settings." : sections.find((item) => item.id === section)?.help}</p></div>{section !== "overview" && <button className="button secondary" onClick={() => setSection("overview")}>Back to More</button>}</header>
    {message && <div className="notice-banner" role="status">{message}<button onClick={() => setMessage("")}>Dismiss</button></div>}
    {section === "overview" && <Overview onOpen={setSection}/>}
    {section === "notes" && <ImportantNotes data={data}/>} {section === "bookings" && <Bookings data={data} onOpenTicket={openTicket} onUpload={uploadBookingFile} onReplaceFile={replaceBookingFile} onDeleteFile={deleteBookingFile} onDeleteBooking={deleteBookingSafely}/>}
    {section === "places" && <Places data={data}/>}
    {section === "alerts" && <Alerts data={data} onMessage={setMessage}/>}
    {section === "members" && <Members data={data}/>}
    {section === "activity" && <ActivityHistory data={data}/>}
    {section === "settings" && <TripSettings data={data} onMessage={setMessage}/>}
    {section === "install" && <Install installPrompt={installPrompt}/>}
  </>;
}

function ImportantNotes({ data }: { data: TripBoardData }) {
  const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<TripNote | null>(null); const [copied, setCopied] = useState<string | null>(null); const [largePhrase, setLargePhrase] = useState<TripNote | null>(null);
  const grouped = new Map<string, TripNote[]>(); for (const note of data.notes.filter(isGuideNote).sort((a, b) => a.sortOrder - b.sortOrder)) { const category = guideCategory(note.section); grouped.set(category, [...(grouped.get(category) ?? []), note]); }
  const copy = async (note: TripNote) => { const text = note.copyText || copyableFor(note.body); if (!text) return; await navigator.clipboard.writeText(text); setCopied(note.id); window.setTimeout(() => setCopied((id) => id === note.id ? null : id), 1800); };
  const hotel = data.places.find((place) => place.category?.toLowerCase().includes("hotel"));
  const category = (name: string) => grouped.get(name) ?? [];
  const phrase = category("Food & language")[0];
  return <><div className="guide-toolbar"><span>Quick reference when you’re already out the door.</span><button className="button secondary" onClick={() => setAdding(true)}><Plus size={16}/> Add reference</button></div><section className="field-guide">{phrase && <section className="guide-panel guide-phrase"><GuideHeading icon="🍜" title="Essentials & language"/><p className="phrase-label">Say this when ordering</p><h2>{phrase.title}</h2><strong className="phrase-chinese">{phrase.copyText || copyableFor(phrase.body)}</strong><p className="phrase-pronunciation">Say it like: {friendlyPronunciation(phrase)}</p><p className="phrase-meaning">Meaning: {phraseMeaning(phrase)}</p><GuideActions note={phrase} copied={copied} onCopy={copy} onEdit={setEditing} onDelete={() => void data.deleteNote(phrase.id)}/><button className="text-button guide-large" onClick={() => setLargePhrase(phrase)}>Show large</button></section>}{hotel && <section className="guide-panel guide-hotel"><GuideHeading icon="🏨" title="Get me home"/><strong>{hotel.name}</strong><address>{hotel.address}</address><button className="text-button" onClick={() => void navigator.clipboard.writeText(hotel.address ?? "")}><Copy size={14}/> Copy address</button></section>}{category("After landing").map((note) => <section className="guide-panel guide-sequence" key={note.id}><GuideHeading icon="✈️" title="After landing at HKG"/><ol>{splitPoints(note.body).map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol><GuideActions note={note} copied={copied} onCopy={copy} onEdit={setEditing} onDelete={() => void data.deleteNote(note.id)}/></section>)}{category("Money").length > 0 && <section className="guide-panel guide-money"><GuideHeading icon="💳" title="Money & payments"/><div className="guide-rules">{category("Money").map((note) => <article key={note.id}><strong>{note.title}</strong><p>{note.summary || summaryFor(note.body)}</p><ul>{splitPoints(note.body).slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul><GuideActions note={note} copied={copied} onCopy={copy} onEdit={setEditing} onDelete={() => void data.deleteNote(note.id)}/></article>)}</div></section>}{["Macau", "Connectivity", "Transport", "Food"].map((name) => category(name).length ? <section className="guide-panel guide-checks" key={name}><GuideHeading icon={guideIcon(name)} title={name}/>{category(name).map((note) => <article key={note.id}><strong>{note.title}</strong><ul>{splitPoints(note.summary || note.body).map((item) => <li key={item}>{item}</li>)}</ul><GuideActions note={note} copied={copied} onCopy={copy} onEdit={setEditing} onDelete={() => void data.deleteNote(note.id)}/></article>)}</section> : null)}</section>{grouped.size === 0 && <div className="panel empty-state"><StickyNote size={28}/><h3>No quick references yet</h3><p>Add a reusable phrase, payment rule, or travel essential.</p></div>}{largePhrase && <Modal title={largePhrase.title} description="Show this directly to staff." onClose={() => setLargePhrase(null)}><div className="large-phrase"><strong>{largePhrase.copyText || copyableFor(largePhrase.body)}</strong><span>{friendlyPronunciation(largePhrase)}</span><p>{phraseMeaning(largePhrase)}</p></div></Modal>}{adding && <NoteModal onClose={() => setAdding(false)} onSave={async (note) => { await data.addNote(note); setAdding(false); }}/>} {editing && <NoteModal note={editing} onClose={() => setEditing(null)} onSave={async (note) => { await data.editNote(editing.id, note); setEditing(null); }}/>}</>;
}

function GuideHeading({ icon, title }: { icon: string; title: string }) { return <h3><span aria-hidden="true">{icon}</span>{title}</h3>; }
function GuideActions({ note, copied, onCopy, onEdit, onDelete }: { note: TripNote; copied: string | null; onCopy: (note: TripNote) => Promise<void>; onEdit: (note: TripNote) => void; onDelete: () => void }) { return <div className="guide-actions">{(note.copyText || copyableFor(note.body)) && <button className="text-button" onClick={() => void onCopy(note)}><Copy size={14}/>{copied === note.id ? "Copied" : "Copy"}</button>}<button className="text-button" onClick={() => onEdit(note)}><Pencil size={14}/> Edit</button><button className="text-button danger" onClick={() => { if (window.confirm(`Delete “${note.title}”?`)) onDelete(); }}><Trash2 size={14}/> Delete</button></div>; }

function isGuideNote(note: TripNote) { return !note.section.toLowerCase().includes("culture") && !note.title.toLowerCase().includes("pre-trip"); }
function guideCategory(section: string) { const value = section.toLowerCase(); if (value.includes("arrival")) return "After landing"; if (value.includes("food") && value.includes("strategy")) return "Food"; if (value.includes("food") || value.includes("language")) return "Food & language"; if (value.includes("money")) return "Money"; if (value.includes("transport") || value.includes("octopus")) return "Transport"; if (value.includes("connect")) return "Connectivity"; if (value.includes("macau")) return "Macau"; return section; }
function guideIcon(category: string) { return ({ "Food & language": "🍜", Money: "💳", Transport: "🚇", Connectivity: "📶", Macau: "🇲🇴", Essentials: "🧳" } as Record<string, string>)[category] ?? "📌"; }
function summaryFor(body: string) { const sentence = body.split(/(?<=[.!?。])\s+/)[0] ?? body; return sentence.length > 118 ? `${sentence.slice(0, 115)}…` : sentence; }
function copyableFor(body: string) { return body.match(/[\u3400-\u9fff][\u3400-\u9fff，。]+/)?.[0]; }
function phrasePronunciation(note: TripNote) { return note.pronunciation || (note.title.toLowerCase().includes("no beef") ? "m4 jiu3 ngau4 juk6, m4 jiu3 ngau4 tong1" : "Add pronunciation"); }
function friendlyPronunciation(note: TripNote) { return note.title.toLowerCase().includes("no beef") ? "Mmm yiu ngow yook, mmm yiu ngow tong." : phrasePronunciation(note).replace(/\d/g, ""); }
function phraseMeaning(note: TripNote) { return note.meaning || (note.title.toLowerCase().includes("no beef") ? "No beef, no beef broth." : note.summary || summaryFor(note.body)); }
function splitPoints(value: string) { return value.split(/(?:\r?\n|[•;]|(?<=\.)\s+)/).map((item) => item.trim()).filter(Boolean); }

function NoteModal({ note, onClose, onSave }: { note?: TripNote; onClose: () => void; onSave: (note: Pick<TripNote, "section" | "title" | "body" | "summary" | "icon" | "copyText" | "pronunciation" | "meaning">) => Promise<void> }) {
  const [section, setSection] = useState(note?.section ?? "Essentials"); const [title, setTitle] = useState(note?.title ?? ""); const [summary, setSummary] = useState(note?.summary ?? ""); const [body, setBody] = useState(note?.body ?? ""); const [icon, setIcon] = useState(note?.icon ?? ""); const [copyText, setCopyText] = useState(note?.copyText ?? ""); const [pronunciation, setPronunciation] = useState(note?.pronunciation ?? ""); const [meaning, setMeaning] = useState(note?.meaning ?? ""); const [saving, setSaving] = useState(false);
  return <Modal title={note ? "Edit quick reference" : "Add quick reference"} description="Keep it reusable and easy to scan while travelling." onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ section, title, summary, body, icon, copyText, pronunciation, meaning }); setSaving(false); }}><label>Category<input value={section} onChange={(event) => setSection(event.target.value)} maxLength={80} required placeholder="e.g. Money, Macau, Food & language"/></label><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="e.g. Choose HKD at the ATM"/></label><label>Short answer<input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={240} placeholder="The one-line answer shown on the guide"/></label><label>Chinese phrase <span className="optional">optional</span><input value={copyText} onChange={(event) => setCopyText(event.target.value)} placeholder="Text to show and copy"/></label><label>Jyutping pronunciation <span className="optional">optional</span><input value={pronunciation} onChange={(event) => setPronunciation(event.target.value)} placeholder="e.g. m4 jiu3 ngau4 juk6"/></label><label>English meaning <span className="optional">optional</span><input value={meaning} onChange={(event) => setMeaning(event.target.value)} placeholder="What the phrase means"/></label><label>Icon <span className="optional">optional</span><input value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={16} placeholder="e.g. 💳"/></label><label>More detail<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} required placeholder="Extra context shown only when opened"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save reference"}</button></div></form></Modal>;
}

function Overview({ onOpen }: { onOpen: (section: MoreSection) => void }) {
  return <div className="more-grid">{sections.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => onOpen(item.id)}><span className={`more-icon more-${item.id}`}><Icon size={20}/></span><div><strong>{item.label}</strong><p>{item.help}</p></div><ChevronRight size={18}/></button>; })}<article className="security-card"><ShieldCheck size={21}/><div><strong>Private by design</strong><p>Trip records and ticket files are only available to active members.</p></div></article><article className="sync-card"><Cloud size={21}/><div><strong>Everything is synced</strong><p>Offline changes automatically retry when you reconnect.</p></div></article></div>;
}

function Bookings({ data, onOpenTicket, onUpload, onReplaceFile, onDeleteFile, onDeleteBooking }: { data: TripBoardData; onOpenTicket: (path?: string) => Promise<void>; onUpload: (bookingId: string, file: File) => Promise<void>; onReplaceFile: (bookingId: string, oldFile: { id?: string; path?: string }, file: File) => Promise<void>; onDeleteFile: (file: { id?: string; path?: string }) => Promise<void>; onDeleteBooking: (booking: Booking) => Promise<void> }) {
  const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<Booking | null>(null); const [selected, setSelected] = useState<Booking | null>(null); const handledOpen = useRef(false);
  useEffect(() => { if (handledOpen.current) return; handledOpen.current = true; queueMicrotask(() => { const booking = data.bookings.find((item) => item.id === new URLSearchParams(window.location.search).get("open")); if (booking) setSelected(booking); }); }, [data.bookings]);
  const cancel = async (booking: Booking) => { await data.editBooking(booking.id, { type: booking.type, title: booking.title, provider: booking.provider, reference: booking.reference, startsAt: booking.startsAt, location: booking.location, travellers: booking.travellers, amount: booking.amount, currency: booking.currency, notes: booking.notes, status: "CANCELLED" }); };
  return <><div className="section-actions"><button className="button primary" onClick={() => setAdding(true)}><Plus size={16}/> Add booking</button></div><section className="booking-list">{data.bookings.map((booking) => <article className="panel booking-card" key={booking.id}><div className="booking-icon"><Plane size={21}/></div><button className="booking-main booking-open" onClick={() => setSelected(booking)}><div className="booking-title"><span>{booking.type}</span><h2>{booking.title}</h2><p>{booking.provider || "Provider not added"}</p></div><div className="booking-details"><span><CalendarClock size={15}/>{booking.startsAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: data.trip.timezone }).format(new Date(booking.startsAt)) : "Date to be confirmed"}</span><span><BookOpenCheck size={15}/>Reference <b>{booking.reference || "Not added"}</b></span></div></button><div className="booking-actions"><span className={`booking-status status-${booking.status.toLowerCase()}`}><Check size={13}/>{booking.status}</span><button className="button secondary" onClick={() => setEditing(booking)}><Pencil size={14}/> Edit</button><label className="button secondary upload-button"><Upload size={15}/> Upload<input aria-label={`Upload file for ${booking.title}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(booking.id, file); event.currentTarget.value = ""; }}/></label></div></article>)}{data.bookings.length === 0 && <div className="panel empty-state"><Ticket size={28}/><h3>No bookings yet</h3><p>Add transport, accommodation, tickets, or reservations.</p></div>}</section>
    {adding && <BookingFormModal onClose={() => setAdding(false)} onSave={async (booking) => { await data.addBooking(booking); setAdding(false); }}/>} {editing && <BookingFormModal booking={editing} onClose={() => setEditing(null)} onSave={async (booking) => { await data.editBooking(editing.id, booking); setEditing(null); }}/>} {selected && <BookingDetailModal booking={data.bookings.find((item) => item.id === selected.id) ?? selected} timezone={data.trip.timezone} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onCancel={async () => { await cancel(selected); setSelected(null); }} onDelete={async () => { await onDeleteBooking(selected); setSelected(null); }} onOpenTicket={onOpenTicket} onReplaceFile={onReplaceFile} onDeleteFile={onDeleteFile}/>}
  </>;
}

type EditableBooking = Omit<Booking, "id" | "tripId" | "files">;
function BookingFormModal({ booking, onClose, onSave }: { booking?: Booking; onClose: () => void; onSave: (booking: EditableBooking) => Promise<void> }) {
  const [title, setTitle] = useState(booking?.title ?? ""); const [type, setType] = useState(booking?.type ?? "OTHER"); const [provider, setProvider] = useState(booking?.provider ?? ""); const [reference, setReference] = useState(booking?.reference ?? ""); const [startsAt, setStartsAt] = useState(booking?.startsAt ? new Date(booking.startsAt).toISOString().slice(0, 16) : ""); const [location, setLocation] = useState(booking?.location ?? ""); const [travellers, setTravellers] = useState(booking?.travellers?.join(", ") ?? ""); const [amount, setAmount] = useState(booking?.amount ?? ""); const [currency, setCurrency] = useState(booking?.currency ?? "INR"); const [notes, setNotes] = useState(booking?.notes ?? ""); const [status, setStatus] = useState<Booking["status"]>(booking?.status ?? "CONFIRMED"); const [saving, setSaving] = useState(false);
  return <Modal title={booking ? "Edit booking" : "Add booking"} description="Keep ticket details and travellers together." onClose={onClose} wide><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ title: title.trim(), type, provider: provider.trim() || undefined, reference: reference.trim() || undefined, startsAt: startsAt ? new Date(startsAt).toISOString() : undefined, location: location.trim() || undefined, travellers: travellers.split(",").map((value) => value.trim()).filter(Boolean), amount: amount || undefined, currency: amount ? currency : undefined, notes: notes.trim() || undefined, status }); setSaving(false); }}><label>Booking title<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="e.g. Ferry to Macau"/></label><div className="form-grid"><label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{["FLIGHT","HOTEL","ATTRACTION","FERRY","CRUISE","THEME_PARK","CABLE_CAR","TOUR","INSURANCE","ESIM","OTHER"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as Booking["status"])}><option>PLACEHOLDER</option><option>CONFIRMED</option><option>USED</option><option>CANCELLED</option></select></label><label>Provider<input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Airline, hotel, operator"/></label><label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Confirmation or ticket number"/></label><label>Date and time<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)}/></label><label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Terminal, hotel, meeting point"/></label></div><label>Travellers <span className="optional">comma separated</span><input value={travellers} onChange={(event) => setTravellers(event.target.value)} placeholder="Alex, Sam"/></label><div className="form-grid"><label>Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00"/></label><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>INR</option><option>HKD</option><option>MOP</option><option>USD</option><option>EUR</option><option>GBP</option></select></label></div><label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Check-in instructions, baggage, cancellation terms…"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : booking ? "Save booking" : "Add booking"}</button></div></form></Modal>;
}

function BookingDetailModal({ booking, timezone, onClose, onEdit, onCancel, onDelete, onOpenTicket, onReplaceFile, onDeleteFile }: { booking: Booking; timezone: string; onClose: () => void; onEdit: () => void; onCancel: () => Promise<void>; onDelete: () => Promise<void>; onOpenTicket: (path?: string) => Promise<void>; onReplaceFile: (bookingId: string, oldFile: { id?: string; path?: string }, file: File) => Promise<void>; onDeleteFile: (file: { id?: string; path?: string }) => Promise<void> }) {
  return <Modal title={booking.title} description={`${booking.type.replaceAll("_", " ")} · ${booking.status}`} onClose={onClose} wide><div className="detail-grid"><div><span>Provider</span><strong>{booking.provider || "Not added"}</strong></div><div><span>Reference</span><strong className="reference-value">{booking.reference || "Not added"}</strong></div><div><span>Date and time</span><strong>{booking.startsAt ? new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(booking.startsAt)) : "Not confirmed"}</strong></div><div><span>Location</span><strong>{booking.location || "Not added"}</strong></div><div><span>Travellers</span><strong>{booking.travellers?.join(", ") || "Not added"}</strong></div><div><span>Amount</span><strong>{booking.amount ? `${booking.currency} ${booking.amount}` : "Not added"}</strong></div></div>{booking.notes && <section className="detail-notes"><h3>Notes</h3><p>{booking.notes}</p></section>}<section className="detail-files"><h3>Tickets and documents</h3>{booking.files.length === 0 ? <div className="mini-empty">No files uploaded.</div> : booking.files.map((file) => <article key={file.path ?? file.name}><button className="file-open" onClick={() => void onOpenTicket(file.path)}>{file.kind === "PDF" ? <FileText size={16}/> : <FileImage size={16}/>}<span><strong>{file.name}</strong><small>Open private file</small></span><ExternalLink size={14}/></button><label className="text-button upload-button"><RefreshCw size={13}/> Replace<input aria-label={`Replace ${file.name}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const replacement = event.target.files?.[0]; if (replacement) void onReplaceFile(booking.id, file, replacement); event.currentTarget.value = ""; }}/></label><button className="text-button danger" onClick={() => void onDeleteFile(file)}><Trash2 size={13}/> Delete</button></article>)}</section><div className="form-actions detail-actions"><button className="button secondary" onClick={onEdit}><Pencil size={14}/> Edit</button>{booking.status !== "CANCELLED" && <button className="button secondary" onClick={() => void onCancel()}><XCircle size={14}/> Cancel booking</button>}<button className="button danger" onClick={() => void onDelete()}><Trash2 size={14}/> Delete</button></div></Modal>;
}

function Places({ data }: { data: TripBoardData }) {
  const [search, setSearch] = useState(""); const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<Place | null>(null); const [selected, setSelected] = useState<Place | null>(null);
  const places = data.places.filter((place) => `${place.name} ${place.neighbourhood ?? ""} ${place.category ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="section-actions"><button className="button primary" onClick={() => setAdding(true)}><Plus size={16}/> Add place</button></div><section className="panel places-panel"><label className="search-field"><MapPin size={16}/><span className="sr-only">Search places</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search places or neighbourhoods"/></label><div className="places-list">{places.map((place) => <article key={place.id}><span className="place-pin"><MapPin size={17}/></span><button className="place-open" onClick={() => setSelected(place)}><div><h2>{place.name}</h2><span className={`priority-badge ${place.priority.toLowerCase()}`}>{place.priority}</span></div><p>{[place.category, place.neighbourhood].filter(Boolean).join(" · ") || "Place"}</p><address>{place.address || "Address not added"}</address></button><button className="button secondary" onClick={() => setEditing(place)}><Pencil size={14}/> Edit</button></article>)}{places.length === 0 && <div className="empty-state"><MapPin size={28}/><h3>{data.places.length ? "No places match" : "No places yet"}</h3><p>Add somewhere you want to visit, eat, shop, or stay.</p></div>}</div></section>{adding && <PlaceFormModal onClose={() => setAdding(false)} onSave={async (place) => { await data.addPlace(place); setAdding(false); }}/>} {editing && <PlaceFormModal place={editing} onClose={() => setEditing(null)} onSave={async (place) => { await data.editPlace(editing.id, place); setEditing(null); }}/>} {selected && <PlaceDetailModal place={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onDelete={async () => { if (window.confirm(`Delete “${selected.name}”? Linked itinerary and checklist items will remain but lose this link.`)) { await data.deletePlace(selected.id); setSelected(null); } }}/>}</>;
}

type EditablePlace = Omit<Place, "id" | "tripId">;
function PlaceFormModal({ place, onClose, onSave }: { place?: Place; onClose: () => void; onSave: (place: EditablePlace) => Promise<void> }) {
  const [name, setName] = useState(place?.name ?? ""); const [address, setAddress] = useState(place?.address ?? ""); const [mapsUrl, setMapsUrl] = useState(place?.mapsUrl ?? ""); const [neighbourhood, setNeighbourhood] = useState(place?.neighbourhood ?? ""); const [category, setCategory] = useState(place?.category ?? "Attraction"); const [hours, setHours] = useState(place?.openingHoursNotes ?? ""); const [notes, setNotes] = useState(place?.notes ?? ""); const [duration, setDuration] = useState(place?.expectedDurationMinutes?.toString() ?? ""); const [priority, setPriority] = useState<Priority>(place?.priority ?? "WANT"); const [saving, setSaving] = useState(false);
  return <Modal title={place ? "Edit place" : "Add place"} description="Save the practical details everyone will need." onClose={onClose} wide><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ name: name.trim(), address: address.trim() || undefined, mapsUrl: mapsUrl.trim() || undefined, neighbourhood: neighbourhood.trim() || undefined, category: category.trim() || undefined, openingHoursNotes: hours.trim() || undefined, notes: notes.trim() || undefined, expectedDurationMinutes: duration ? Number(duration) : undefined, priority }); setSaving(false); }}><label>Place name<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="e.g. Tian Tan Buddha"/></label><div className="form-grid"><label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Attraction, restaurant, hotel…"/></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option>MUST</option><option>WANT</option><option>OPTIONAL</option></select></label><label>Neighbourhood<input value={neighbourhood} onChange={(event) => setNeighbourhood(event.target.value)} placeholder="Lantau"/></label><label>Expected duration (minutes)<input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)}/></label></div><label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Full street address"/></label><label>Map link<input type="url" value={mapsUrl} onChange={(event) => setMapsUrl(event.target.value)} placeholder="https://maps.google.com/…"/></label><label>Opening hours and timing notes<textarea value={hours} onChange={(event) => setHours(event.target.value)} rows={3} placeholder="Closed Tuesdays; last entry 17:30"/></label><label>Shared notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="What to see, accessibility, food nearby…"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : place ? "Save place" : "Add place"}</button></div></form></Modal>;
}

function PlaceDetailModal({ place, onClose, onEdit, onDelete }: { place: Place; onClose: () => void; onEdit: () => void; onDelete: () => Promise<void> }) {
  return <Modal title={place.name} description={[place.category, place.neighbourhood].filter(Boolean).join(" · ")} onClose={onClose} wide><div className="detail-grid"><div><span>Priority</span><strong>{place.priority}</strong></div><div><span>Duration</span><strong>{place.expectedDurationMinutes ? formatDuration(place.expectedDurationMinutes) : "Not added"}</strong></div><div className="detail-wide"><span>Address</span><strong>{place.address || "Not added"}</strong></div><div className="detail-wide"><span>Opening hours</span><strong>{place.openingHoursNotes || "Not added"}</strong></div></div>{place.notes && <section className="detail-notes"><h3>Notes</h3><p>{place.notes}</p></section>}<div className="form-actions detail-actions">{place.mapsUrl && <a className="button secondary" href={place.mapsUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open map</a>}<button className="button secondary" onClick={onEdit}><Pencil size={14}/> Edit</button><button className="button danger" onClick={() => void onDelete()}><Trash2 size={14}/> Delete</button></div></Modal>;
}

function Alerts({ data, onMessage }: { data: TripBoardData; onMessage: (message: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [preferenceVersion, setPreferenceVersion] = useState<number | null>(null);
  const [preferences, setPreferences] = useState({ morning: true, leave: true, overdue: true, endOfDay: true, budget: true, booking: true, wallet: false });
  const [notifications, setNotifications] = useState<{ id: string; type: string; entity_id: string | null; title: string; body: string; created_at: string; read_at: string | null }[]>([]);
  useEffect(() => { const load = async () => { const client = getSupabaseBrowserClient(); if (!client || !data.trip.id) return; const { data: userData } = await client.auth.getUser(); if (!userData.user) return; const [{ data: saved }, { data: inbox }] = await Promise.all([client.from("notification_preferences").select("*").eq("trip_id", data.trip.id).eq("user_id", userData.user.id).maybeSingle(), client.from("notifications").select("id,type,entity_id,title,body,created_at,read_at").eq("trip_id", data.trip.id).order("created_at", { ascending: false }).limit(20)]); if (saved) { setPreferences({ morning: saved.morning_summary, leave: saved.leave_soon, overdue: saved.overdue_item, endOfDay: saved.end_of_day, budget: saved.budget_warning, booking: saved.booking_reminder, wallet: saved.low_wallet }); setPreferenceVersion(saved.version ?? 1); } setNotifications(inbox ?? []); }; void load(); const client = getSupabaseBrowserClient(); if (!client) return; const channel = client.channel(`inbox:${data.trip.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `trip_id=eq.${data.trip.id}` }, () => { void load(); }).on("postgres_changes", { event: "*", schema: "public", table: "notification_preferences", filter: `trip_id=eq.${data.trip.id}` }, () => { void load(); }).subscribe(); return () => { void client.removeChannel(channel); }; }, [data.trip.id]);
  const savePreferences = async (next: typeof preferences) => { const previous = preferences; setPreferences(next); const client = getSupabaseBrowserClient(); if (!client) return; const { data: userData } = await client.auth.getUser(); if (!userData.user) return; const payload = { user_id: userData.user.id, trip_id: data.trip.id, morning_summary: next.morning, leave_soon: next.leave, overdue_item: next.overdue, end_of_day: next.endOfDay, budget_warning: next.budget, booking_reminder: next.booking, low_wallet: next.wallet, ...(preferenceVersion ? { expectedVersion: preferenceVersion } : {}) }; if (!navigator.onLine) { await enqueueMutation({ tripId: data.trip.id, entity: "notification-preference", command: "upsert", payload }); onMessage("Alert preference saved on this device and queued."); return; } const databasePayload = { ...payload }; delete databasePayload.expectedVersion; const { error } = await client.from("notification_preferences").upsert(databasePayload); if (error) { setPreferences(previous); onMessage("Alert preference could not be saved."); } else setPreferenceVersion((version) => (version ?? 0) + 1); };
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
  const rows = [{ key: "morning", title: "Morning summary", help: "Today’s plan and first departure" }, { key: "leave", title: "Leave soon", help: "A practical departure reminder" }, { key: "overdue", title: "Overdue items", help: "Actions that still need a decision" }, { key: "endOfDay", title: "End-of-day review", help: "Unresolved activities before the day ends" }, { key: "budget", title: "Budget warnings", help: "One alert at 80% and 100%" }, { key: "booking", title: "Booking reminders", help: "Tickets when you need them" }, { key: "wallet", title: "Low wallet", help: "Optional Octopus and cash alerts" }] as const;
  const toggleRead = async (notice: typeof notifications[number]) => { const client = getSupabaseBrowserClient(); if (!client) return; const next = notice.read_at ? null : new Date().toISOString(); setNotifications((items) => items.map((item) => item.id === notice.id ? { ...item, read_at: next } : item)); const { error } = await client.from("notifications").update({ read_at: next }).eq("id", notice.id); if (error) onMessage("This alert could not be updated."); };
  const openNotification = async (notice: typeof notifications[number]) => { if (!notice.read_at) await toggleRead(notice); const id = notice.entity_id ? encodeURIComponent(notice.entity_id) : ""; let target = "/plan"; if (notice.type === "BOOKING_REMINDER") target = `/bookings${id ? `?open=${id}` : ""}`; else if (["BUDGET_WARNING", "LOW_WALLET"].includes(notice.type)) target = notice.type === "BUDGET_WARNING" ? "/money#budgets" : "/money#accounts"; else if (["LEAVE_SOON", "OVERDUE_ITEM"].includes(notice.type) && id) target = `/plan?open=${id}`; else if (notice.type === "MORNING_SUMMARY") target = "/today"; window.location.assign(target); };
  return <div className="settings-grid"><section className="panel alert-enable"><span className="alert-hero-icon"><BellRing size={24}/></span><div><h2>{enabled ? "Trip alerts enabled" : "Enable trip alerts"}</h2><p>Get timely departures, booking reminders, and end-of-day reviews on this device.</p></div><button className="button primary" onClick={() => void enable()} disabled={enabled}>{enabled ? <><Check size={16}/> Enabled</> : "Enable alerts"}</button></section><section className="panel preference-list"><h2>Alert preferences</h2>{rows.map((row) => <label key={row.key}><div><strong>{row.title}</strong><p>{row.help}</p></div><input aria-label={row.title} type="checkbox" checked={preferences[row.key]} onChange={(event) => void savePreferences({...preferences, [row.key]: event.target.checked})}/><span className="toggle"/></label>)}</section><section className="panel notification-inbox"><div className="panel-heading"><div><h2>Recent alerts</h2><p>{notifications.filter((notice) => !notice.read_at).length} unread</p></div></div>{notifications.length ? notifications.map((notice) => <article key={notice.id} className={notice.read_at ? "" : "unread"}><Bell size={15}/><button className="notification-open" onClick={() => void openNotification(notice)}><strong>{notice.title}</strong><p>{notice.body}</p><span>Open related item</span></button><button className="text-button" onClick={() => void toggleRead(notice)}>{notice.read_at ? "Mark unread" : "Mark read"}</button></article>) : <div className="mini-empty">No trip alerts yet.</div>}</section></div>;
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

type MemberRow = { user_id: string; role: string; version?: number; profiles: { display_name: string | null; email: string } | null };
type InviteRow = { id: string; email: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string };

function Members({ data }: { data: TripBoardData }) {
  const [inviteOpen, setInviteOpen] = useState(false); const [email, setEmail] = useState(""); const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState(""); const [creating, setCreating] = useState(false); const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]); const [invites, setInvites] = useState<InviteRow[]>([]); const [removing, setRemoving] = useState<MemberRow | null>(null);
  const reloadMembers = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const [{ data: activeMembers }, { data: inviteRows }] = await Promise.all([
      client.from("trip_members").select("user_id,role,version,profiles(display_name,email)").eq("trip_id", data.trip.id).is("removed_at", null),
      client.from("trip_invites").select("id,email,expires_at,accepted_at,revoked_at,created_at").eq("trip_id", data.trip.id).order("created_at", { ascending: false }),
    ]);
    setMembers((activeMembers ?? []).map((member) => ({ user_id: String(member.user_id), role: String(member.role), version: member.version ?? 1, profiles: Array.isArray(member.profiles) ? (member.profiles[0] ?? null) : member.profiles })) as MemberRow[]);
    setInvites((inviteRows ?? []) as InviteRow[]);
  }, [data.trip.id]);
  useEffect(() => {
    queueMicrotask(() => { void reloadMembers(); }); const client = getSupabaseBrowserClient(); if (!client) return;
    const channel = client.channel(`members:${data.trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${data.trip.id}` }, () => { void reloadMembers(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_invites", filter: `trip_id=eq.${data.trip.id}` }, () => { void reloadMembers(); }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [data.trip.id, reloadMembers]);

  const issueInvite = async (targetEmail: string) => {
    const client = getSupabaseBrowserClient(); if (!client) throw new Error("Connect Supabase before inviting someone.");
    if (!navigator.onLine) throw new Error("Creating an invite needs a connection because the secure link is issued by the server.");
    const { data: result, error: inviteError } = await client.rpc("create_trip_invite", { p_trip_id: data.trip.id, p_email: targetEmail.trim().toLowerCase() });
    if (inviteError) throw new Error(inviteError.message);
    const response = result as { token?: string } | null; if (!response?.token) throw new Error("The server did not return an invite link.");
    const link = `${window.location.origin}/login?invite=${encodeURIComponent(response.token)}`; setEmail(targetEmail.trim().toLowerCase()); setInviteLink(link); await reloadMembers(); return link;
  };
  const createInvite = async (event: React.FormEvent) => { event.preventDefault(); setCreating(true); setError(""); setCopied(false); try { await issueInvite(email); } catch (cause) { setError(cause instanceof Error ? cause.message : "The invite could not be created."); } finally { setCreating(false); } };
  const renewAndCopy = async (targetEmail: string) => { setCreating(true); setError(""); try { const link = await issueInvite(targetEmail); await navigator.clipboard.writeText(link); setCopied(true); setInviteOpen(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "The invite could not be renewed."); } finally { setCreating(false); } };
  const copyInvite = async () => { await navigator.clipboard.writeText(inviteLink); setCopied(true); };
  const revokeInvite = async (id: string) => { const client = getSupabaseBrowserClient(); if (!client) return; const now = new Date().toISOString(); if (!navigator.onLine) { await enqueueMutation({ tripId: data.trip.id, entity: "member", command: "revoke-invite", payload: { id, revokedAt: now } }); setInvites((items) => items.map((item) => item.id === id ? { ...item, revoked_at: now, expires_at: now } : item)); return; } const { error: revokeError } = await client.from("trip_invites").update({ expires_at: now, revoked_at: now }).eq("id", id); if (revokeError) setError(revokeError.message); await reloadMembers(); };

  return <>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <div className="settings-grid"><section className="panel member-list"><div className="panel-heading"><div><h2>Travelling together</h2><p>Each traveller has a separate sign-in and shared trip access.</p></div><button className="button primary" onClick={() => { setInviteOpen(true); setEmail(""); setInviteLink(""); setError(""); }}><Plus size={15}/> Invite traveller</button></div>
      {members.map((member) => <article key={member.user_id}><span className={`member-avatar ${member.role === "OWNER" ? "owner" : ""}`}>{(member.profiles?.display_name ?? member.profiles?.email ?? "?").slice(0, 1).toUpperCase()}</span><div><strong>{member.profiles?.display_name ?? "Trip member"}</strong><p>{member.profiles?.email} · {member.role === "OWNER" ? "Owner" : "Member"}</p></div>{member.role === "OWNER" ? <span>Active</span> : <button className="text-button" onClick={() => setRemoving(member)}><UserMinus size={14}/> Remove</button>}</article>)}
    </section><section className="panel shared-principle"><Users size={22}/><h2>One shared trip</h2><p>Removing someone immediately ends their access without deleting the activities or financial history they contributed.</p></section></div>
    <section className="panel invite-history"><div className="panel-heading"><div><h2>Invitation history</h2><p>Pending, accepted, expired, and revoked invitations.</p></div></div>{invites.length === 0 ? <div className="mini-empty">No invitations yet.</div> : invites.map((invite) => { const status = invite.accepted_at ? "Accepted" : invite.revoked_at ? "Revoked" : new Date(invite.expires_at) <= new Date() ? "Expired" : "Pending"; return <article key={invite.id}><div><strong>{invite.email}</strong><p>Created {new Date(invite.created_at).toLocaleDateString()} · expires {new Date(invite.expires_at).toLocaleDateString()}</p></div><span className={`invite-status ${status === "Accepted" ? "accepted" : status === "Pending" ? "pending" : "expired"}`}>{status}</span>{!invite.accepted_at && <div className="invite-actions"><button className="text-button" disabled={creating} onClick={() => void renewAndCopy(invite.email)}><RefreshCw size={13}/> Renew & copy</button>{status === "Pending" && <button className="text-button danger" onClick={() => void revokeInvite(invite.id)}>Revoke</button>}</div>}</article>; })}</section>
    {inviteOpen && <Modal title="Invite a traveller" description="The private link works only for this email and expires after seven days." onClose={() => setInviteOpen(false)}><form className="form-stack" onSubmit={createInvite}>{!inviteLink ? <><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="traveller@example.com" required/></label><button className="button primary full" disabled={creating}>{creating ? "Creating secure link…" : "Create invite link"}</button></> : <><div className="invite-ready"><Check size={18}/><div><strong>Invite ready for {email}</strong><p>Only the most recently generated link remains valid.</p></div></div><label>Private invite link<input className="invite-link" value={inviteLink} readOnly onFocus={(event) => event.currentTarget.select()}/></label><button type="button" className="button primary full" onClick={() => void copyInvite()}><Copy size={15}/>{copied ? "Copied" : "Copy link"}</button></>}{error && <div className="form-error" role="alert">{error}</div>}</form></Modal>}
    {removing && <RemoveMemberModal member={removing} tripId={data.trip.id} onClose={() => setRemoving(null)} onRemoved={async () => { const removedId = removing.user_id; setRemoving(null); if (navigator.onLine) await reloadMembers(); else setMembers((items) => items.filter((item) => item.user_id !== removedId)); }}/>}
  </>;
}

function RemoveMemberModal({ member, tripId, onClose, onRemoved }: { member: MemberRow; tripId: string; onClose: () => void; onRemoved: () => Promise<void> }) {
  const [reason, setReason] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const name = member.profiles?.display_name ?? member.profiles?.email ?? "this member";
  return <Modal title={`Remove ${name}?`} description="They will immediately lose access. Their past edits, itinerary changes, and money history stay attached to the trip." onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return; setSaving(true); setError(""); if (!navigator.onLine) { await enqueueMutation({ tripId, entity: "member", command: "remove", payload: { userId: member.user_id, expectedVersion: member.version ?? 1, reason: reason.trim() || null } }); setSaving(false); await onRemoved(); return; } const { error: removeError } = await client.rpc("remove_trip_member", { p_trip_id: tripId, p_user_id: member.user_id, p_reason: reason.trim() || null }); setSaving(false); if (removeError) { setError(removeError.message); return; } await onRemoved(); }}><label>Reason <span className="optional">optional, saved in activity history</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Why access is being removed"/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Keep member</button><button className="button danger" disabled={saving}><UserMinus size={15}/>{saving ? "Removing…" : "Remove access"}</button></div></form></Modal>;
}

type AuditRow = { id: string; entity_type: string; event_type: string; before_json: Record<string, unknown> | null; after_json: Record<string, unknown> | null; created_at: string; profiles: { display_name: string | null; email: string } | { display_name: string | null; email: string }[] | null };

function ActivityHistory({ data }: { data: TripBoardData }) {
  const [events, setEvents] = useState<AuditRow[]>([]); const [error, setError] = useState("");
  useEffect(() => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const load = async () => { const { data: rows, error: loadError } = await client.from("audit_events").select("id,entity_type,event_type,before_json,after_json,created_at,profiles(display_name,email)").eq("trip_id", data.trip.id).order("created_at", { ascending: false }).limit(100); if (loadError) setError("Activity history could not be loaded."); else setEvents((rows ?? []) as AuditRow[]); };
    void load(); const channel = client.channel(`activity:${data.trip.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_events", filter: `trip_id=eq.${data.trip.id}` }, () => { void load(); }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [data.trip.id]);
  return <section className="panel activity-history"><div className="panel-heading"><div><h2>Shared activity</h2><p>The latest changes across this trip.</p></div></div>{error && <div className="form-error">{error}</div>}{events.length === 0 && !error ? <div className="mini-empty">No recorded changes yet.</div> : events.map((event) => { const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles; return <article key={event.id}><span className="activity-avatar">{(profile?.display_name ?? profile?.email ?? "S").slice(0, 1).toUpperCase()}</span><div><strong>{profile?.display_name ?? profile?.email ?? "System"}</strong><p>{describeAuditEvent(event)}</p></div><time dateTime={event.created_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: data.trip.timezone }).format(new Date(event.created_at))}</time></article>; })}</section>;
}

function describeAuditEvent(event: AuditRow) {
  const value = event.after_json ?? event.before_json ?? {}; const label = String(value.title ?? value.name ?? value.email ?? "an item");
  if (event.event_type === "MEMBER_REMOVED") return `removed a trip member${value.reason ? `: ${String(value.reason)}` : ""}`;
  if (event.entity_type === "itinerary_items" && event.event_type === "UPDATE") {
    const before = event.before_json ?? {}; const after = event.after_json ?? {}; const reason = after.change_reason ? `: ${String(after.change_reason)}` : "";
    if (before.date !== after.date) return `moved activity “${label}” to ${String(after.date)}${reason}`;
    if (before.sequence !== after.sequence) return `reordered activity “${label}”${reason}`;
    if (before.status !== after.status) return `marked activity “${label}” ${String(after.status).toLowerCase()}${reason}`;
  }
  if (event.entity_type === "checklist_items" && event.event_type === "UPDATE" && event.before_json?.status !== event.after_json?.status) return `marked checklist item “${label}” ${String(event.after_json?.status).toLowerCase()}`;
  const noun: Record<string, string> = { trip_invites: "invitation", trip_members: "member access", itinerary_days: "travel day", itinerary_items: "activity", checklist_items: "checklist item", places: "place", bookings: "booking", payment_accounts: "payment account", financial_transactions: "money entry", budgets: "budget", trips: "trip settings" };
  const action: Record<string, string> = { INSERT: "added", UPDATE: "updated", DELETE: "deleted" };
  return `${action[event.event_type] ?? event.event_type.toLowerCase()} ${noun[event.entity_type] ?? event.entity_type.replaceAll("_", " ")} “${label}”`;
}

function TripSettings({ data, onMessage }: { data: TripBoardData; onMessage: (message: string) => void }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [name, setName] = useState(data.trip.name);
  const [timezone, setTimezone] = useState(data.trip.timezone);
  const [currency, setCurrency] = useState(data.trip.baseCurrency);
  const [savingSettings, setSavingSettings] = useState(false);
  const logout = async () => { const client = getSupabaseBrowserClient(); if (client) await client.auth.signOut(); window.location.href = "/login"; };
  const exportTrip = () => {
    const blob = new Blob([JSON.stringify({ trip: data.trip, itinerary: data.itinerary, checklist: data.checklist, places: data.places, bookings: data.bookings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "tripboard-export.json"; link.click(); URL.revokeObjectURL(url); onMessage("Trip export downloaded.");
  };
  return <><div className="settings-grid"><form className="panel settings-form" onSubmit={async (event) => { event.preventDefault(); setSavingSettings(true); await data.updateTripSettings({ name, timezone, baseCurrency: currency }); setSavingSettings(false); onMessage("Trip settings saved for everyone."); }}><h2>Trip configuration</h2><label>Trip name<input value={name} onChange={(event) => setName(event.target.value)} required/></label><label>Trip timezone<select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Hong_Kong">Asia/Hong_Kong</option><option value="Asia/Kolkata">Asia/Kolkata</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="Europe/London">Europe/London</option></select><small>Schedules and alerts always use the trip timezone.</small></label><label>Base currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>INR</option><option>HKD</option><option>MOP</option></select></label><button className="button primary" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save settings"}</button></form><section className="panel account-tools"><h2>Your account</h2><button onClick={() => setPasswordOpen(true)}><LockKeyhole size={17}/><div><strong>Set sign-in password</strong><p>Use a password instead of an email sign-in link.</p></div><ChevronRight size={17}/></button><button onClick={exportTrip}><Download size={17}/><div><strong>Export trip JSON</strong><p>Download itinerary, checklist, places, and bookings.</p></div><ChevronRight size={17}/></button><button onClick={() => void logout()}><LogOut size={17}/><div><strong>Log out</strong><p>Remove this account’s session from this device.</p></div><ChevronRight size={17}/></button></section></div>{passwordOpen && <SetPasswordModal onClose={() => setPasswordOpen(false)} onSaved={(notice) => { setPasswordOpen(false); onMessage(notice); }}/>}</>;
}

function SetPasswordModal({ onClose, onSaved }: { onClose: () => void; onSaved: (notice: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) { setError("The two passwords do not match."); return; }
    const client = getSupabaseBrowserClient();
    if (!client) { setError("Connect Supabase before setting a password."); return; }
    setSaving(true); setError("");
    const { error: updateError } = await client.auth.updateUser({ password });
    setSaving(false);
    if (updateError) { setError("Your password could not be updated. Please try again while signed in."); return; }
    onSaved("Password saved. You can now sign in without an email link on any device.");
  };
  return <Modal title="Set sign-in password" description="Set this once while you are signed in. Use it the next time you open TripBoard on a new device." onClose={onClose}><form className="form-stack" onSubmit={save}><label>New password<input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" required/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" required/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button primary full" disabled={saving}>{saving ? "Saving…" : "Save password"}</button></form></Modal>;
}

type InstallMethod = "installed" | "native" | "ios" | "android" | "desktop";

function Install({ installPrompt }: { installPrompt: InstallPromptEvent | null }) {
  const [method, setMethod] = useState<InstallMethod>("desktop");
  const [status, setStatus] = useState("");
  useEffect(() => {
    const updateMethod = () => {
      const nav = navigator as Navigator & { standalone?: boolean };
      const installed = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setMethod(installed ? "installed" : installPrompt ? "native" : ios ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "desktop");
    };
    updateMethod();
    window.addEventListener("appinstalled", updateMethod);
    return () => window.removeEventListener("appinstalled", updateMethod);
  }, [installPrompt]);
  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setStatus(choice.outcome === "accepted" ? "TripBoard was added to this device." : "No problem. You can install it whenever you are ready.");
  };
  const action = method === "installed"
    ? <p className="install-guidance">TripBoard is already installed on this device.</p>
    : method === "native"
      ? <><button className="button primary" onClick={() => void install()}><Download size={17}/> Install TripBoard</button>{status && <p className="install-guidance" role="status">{status}</p>}</>
      : method === "ios"
        ? <div className="install-guidance"><strong>On iPhone or iPad</strong><span>Tap Share, choose Add to Home Screen, then tap Add.</span></div>
        : method === "android"
          ? <div className="install-guidance"><strong>On Android</strong><span>Open your browser menu, then choose Install app or Add to Home screen.</span></div>
          : <div className="install-guidance"><strong>In this browser</strong><span>Use the install icon in the address bar, or choose Install app from the browser menu.</span></div>;
  return <div className="install-layout"><section className="install-hero panel"><span><Smartphone size={31}/></span><h2>Keep TripBoard one tap away</h2><p>Install the private PWA for a fast app-like launch, cached trip details, and supported trip alerts.</p>{action}</section><section className="panel install-benefits"><article><Wifi size={20}/><div><strong>Useful offline</strong><p>See itinerary, addresses, notes, balances, and recent history without a connection.</p></div></article><article><Bell size={20}/><div><strong>Timely alerts</strong><p>Home Screen web apps can receive trip reminders where standards-based push is supported.</p></div></article><article><Share2 size={20}/><div><strong>Normal browser URLs</strong><p>Every screen still works from a regular link. Installation is optional.</p></div></article></section></div>;
}
