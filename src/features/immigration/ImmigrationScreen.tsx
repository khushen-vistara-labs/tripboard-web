"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeAlert, Check, ClipboardCheck, Copy, FileText, Landmark, Pencil, Plus, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import type { TripNote } from "../../types/domain";
import type { TripBoardData } from "../trip/use-tripboard-data";
import { Modal } from "../../components/ui/Modal";

const IMMIGRATION_SECTION = "immigration";
const SETUP_SECTION = "culture / immigration guide";
const SETUP_TITLE = "Immigration guide initialized";

type ImmigrationDraft = Pick<TripNote, "section" | "title" | "body" | "summary" | "icon" | "copyText" | "pronunciation" | "meaning">;

const starterSections: ImmigrationDraft[] = [
  {
    section: IMMIGRATION_SECTION,
    title: "Best opening answer",
    icon: "shield",
    summary: "Tourism. My wife and I are here for an eight-night holiday from 25 December to 2 January. We have confirmed accommodation and return tickets.",
    body: "Use this when the officer asks only for the purpose of visit. Keep it calm, short, and natural.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Tone & confidence",
    icon: "check",
    body: "Stay calm, polite and confident.\nMaintain normal eye contact.\nGive short, direct answers.\nDo not volunteer unnecessary information.\nDo not sound like you memorized a speech.\nIf unclear, say: “Sorry, could you please repeat the question?”\nNever guess or lie.\nYou and Meghana should know the same basic details.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Shared travel facts",
    icon: "clipboard",
    body: "Purpose: Holiday with your spouse\nDates: 25 December 2026 to 2 January 2027\nDuration: Eight nights\nAccommodation: Add the exact property name and full address near Yau Ma Tei\nReturn: Hong Kong to Bengaluru via Hanoi on 2 January\nPlans: Victoria Harbour, Peak, Ngong Ping, Disneyland, Macau and New Year celebrations\nFunding: Self-funded",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Harshith’s work details",
    icon: "briefcase",
    body: "Occupation: Senior Software Engineer in Bengaluru\nEmployer: Okta, through Bee Talent Solutions\nIf asked about work: This is entirely a personal holiday, and I am on leave.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Meghana’s work details",
    icon: "briefcase",
    body: "Occupation: Add Meghana’s exact designation\nEmployer: Add Meghana’s employer\nRelationship: Travelling with her husband, Harshith\nReminder: Both of you should know each other’s basic work details.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Documents to carry",
    icon: "file",
    body: "Current passports\nSeparate signed PAR notification slip for each person\nConfirmed return-flight tickets\nAccommodation confirmation for all eight nights\nShort day-wise itinerary\nRecent bank statements\nCredit cards and some cash\nTravel insurance\nEmployment ID or employment letter\nRecent salary slips\nMarriage certificate copy\nDisneyland and other advance bookings\nKeep printed copies and offline copies on both phones. Make sure every PAR detail exactly matches the current passport.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Cash & funding",
    icon: "wallet",
    summary: "Cash on hand: HK$3,000–3,500 total — replace this with the actual amount before travel.",
    body: "We are funding the trip ourselves.\nWe have approximately HK$[actual amount] in cash, international credit cards and sufficient funds in our bank accounts.\nUse the actual amount if asked. Keep recent statements accessible offline as supporting evidence.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Immigration Q&A",
    icon: "question",
    body: "Why are you visiting Hong Kong? || We are here for an eight-night holiday and the New Year celebrations.\nWho are you travelling with? || I’m travelling with my wife, Meghana.\nHow long will you stay? || Eight nights, from 25 December to 2 January.\nWhere are you staying? || We have booked [property name], near Yau Ma Tei in Kowloon. Here is the confirmation.\nWhat are you planning to do? || We plan to visit Victoria Harbour, the Peak, Ngong Ping, Disneyland and Macau, and attend the New Year countdown.\nAre you visiting Macau? || Yes, only for a day trip. We will return to our Hong Kong accommodation that evening.\nWhen are you leaving Hong Kong? || On 2 January. We are flying to Bengaluru via Hanoi.\nDo you have a return ticket? || Yes. Here is our confirmed return booking.\nWho paid for the trip? || We are funding the trip ourselves.\nWhat do you do in India? || I’m a Senior Software Engineer based in Bengaluru.\nWhere do you work? || I work with Okta through Bee Talent Solutions.\nAre you going to work or attend meetings? || No. This is entirely a personal holiday, and I am on leave.\nWhy did you choose Hong Kong? || We wanted to experience its attractions, food, Disneyland and the Victoria Harbour New Year celebration.\nIs this your first international trip? || Yes, this is our first international trip.\nDo you know anyone in Hong Kong? || No, we are visiting purely as tourists.\nCan you show your itinerary? || Certainly. I have the complete itinerary here.\nWhat will you do after returning to India? || We will return to Bengaluru and resume our jobs.\nOnly use the first-trip and know-anyone answers if they are true.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "If questioned separately",
    icon: "clipboard",
    body: "Both of you should know the arrival and departure dates.\nKnow the number of nights.\nKnow the property name and full address.\nKnow the return-flight route.\nKnow the main itinerary.\nKnow each other’s occupations.\nKnow who arranged and funded the trip.\nYour wording does not need to match, but the facts must.",
  },
  {
    section: IMMIGRATION_SECTION,
    title: "Avoid saying",
    icon: "alert",
    body: "We haven’t decided where we’ll stay.\nWe might extend the trip.\nI may explore job opportunities.\nI might work remotely.\nMy spouse handled everything.\nI don’t know when our return flight is.\nAnything joking about jobs, immigration or overstaying.\nThat you are worried because Indians allegedly face immigration problems.",
  },
];

const sectionOrder = new Map(starterSections.map((note, index) => [note.title, index]));

export function ImmigrationScreen({ data }: { data: TripBoardData }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TripNote | null>(null);
  const [copied, setCopied] = useState(false);
  const initialisedForTrip = useRef<string | null>(null);
  const notes = data.notes.filter((note) => note.section === IMMIGRATION_SECTION);
  const setupExists = data.notes.some((note) => note.section === SETUP_SECTION && note.title === SETUP_TITLE);

  useEffect(() => {
    if (!data.trip.id || notes.length > 0 || setupExists || initialisedForTrip.current === data.trip.id) return;
    initialisedForTrip.current = data.trip.id;
    void (async () => {
      for (const note of starterSections) await data.addNote(note);
      await data.addNote({ section: SETUP_SECTION, title: SETUP_TITLE, body: "The editable immigration guide was added.", summary: undefined, icon: undefined, copyText: undefined, pronunciation: undefined, meaning: undefined });
    })();
  }, [data, notes.length, setupExists]);

  const orderedNotes = [...notes].sort((a, b) => (sectionOrder.get(a.title) ?? 99) - (sectionOrder.get(b.title) ?? 99) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  const missingDetails = notes.some((note) => /Add Meghana|Add the exact property|HK\$\[actual amount\]/.test(`${note.summary ?? ""}\n${note.body}`));
  const openingAnswer = notes.find((note) => note.title === "Best opening answer")?.summary;
  const copyOpening = async () => {
    if (!openingAnswer) return;
    await navigator.clipboard.writeText(openingAnswer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <main className="immigration-screen">
    <header className="screen-header immigration-header">
      <div><p className="eyebrow">ARRIVAL REFERENCE</p><h1>Immigration</h1><p>A shared, editable reference for a clear and confident arrival.</p></div>
      <button className="button primary" onClick={() => setAdding(true)}><Plus size={16}/> Add section</button>
    </header>

    {missingDetails && <aside className="immigration-missing" role="status"><BadgeAlert size={19}/><div><strong>Complete these before flying</strong><p>Add the property’s full address, Meghana’s designation and employer, and the exact HKD cash amount you will carry.</p></div></aside>}

    <section className="immigration-opening" aria-label="Best opening answer">
      <div className="immigration-opening-icon"><ShieldCheck size={25}/></div>
      <div><span className="eyebrow">BEST OPENING ANSWER</span><blockquote>{openingAnswer ?? "Your opening answer will appear here once the guide is ready."}</blockquote></div>
      <button className="button secondary" onClick={() => void copyOpening()} disabled={!openingAnswer}><Copy size={15}/>{copied ? "Copied" : "Copy answer"}</button>
    </section>

    <section className="immigration-grid" aria-label="Immigration guide sections">
      {orderedNotes.map((note) => <ImmigrationCard key={note.id} note={note} onEdit={() => setEditing(note)} onDelete={() => { if (window.confirm(`Delete “${note.title}”?`)) void data.deleteNote(note.id); }}/>) }
      {orderedNotes.length === 0 && <div className="panel empty-state"><ShieldCheck size={28}/><h3>Creating your immigration guide…</h3><p>Your shared starter sections will appear shortly.</p></div>}
    </section>

    {adding && (
      <ImmigrationSectionModal
        onClose={() => setAdding(false)}
        onSave={async (draft) => {
          await data.addNote(draft);
          setAdding(false);
        }}
      />
    )}
    {editing && (
      <ImmigrationSectionModal
        note={editing}
        onClose={() => setEditing(null)}
        onSave={async (draft) => {
          await data.editNote(editing.id, draft);
          setEditing(null);
        }}
      />
    )}
  </main>;
}

function ImmigrationCard({ note, onEdit, onDelete }: { note: TripNote; onEdit: () => void; onDelete: () => void }) {
  const isQa = note.title === "Immigration Q&A";
  const isOpening = note.title === "Best opening answer";
  const lines = note.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return <article className={`immigration-card ${isQa ? "immigration-qa" : ""} ${isOpening ? "immigration-opening-card" : ""}`}>
    <header><span className="immigration-card-icon"><ImmigrationIcon icon={note.icon}/></span><h2>{note.title}</h2><div className="immigration-card-actions"><button className="icon-button quiet" aria-label={`Edit ${note.title}`} title="Edit section" onClick={onEdit}><Pencil size={16}/></button><button className="icon-button quiet danger" aria-label={`Delete ${note.title}`} title="Delete section" onClick={onDelete}><Trash2 size={16}/></button></div></header>
    {note.summary && !isOpening && <p className="immigration-summary">{note.summary}</p>}
    {isQa ? <div className="immigration-qa-list">{lines.map((line) => {
      const [question, answer] = line.split(" || ");
      if (!answer) return <p className="immigration-note" key={line}>{question}</p>;
      return <article key={line}><strong>{question}</strong><p>“{answer}”</p></article>;
    })}</div> : <ul className="immigration-list">{lines.map((line) => <li key={line}><Check size={14}/><span>{line}</span></li>)}</ul>}
  </article>;
}

function ImmigrationIcon({ icon }: { icon?: string }) {
  if (icon === "wallet") return <WalletCards size={18}/>;
  if (icon === "file") return <FileText size={18}/>;
  if (icon === "alert") return <BadgeAlert size={18}/>;
  if (icon === "briefcase") return <Landmark size={18}/>;
  if (icon === "clipboard") return <ClipboardCheck size={18}/>;
  return <ShieldCheck size={18}/>;
}

function ImmigrationSectionModal({ note, onClose, onSave }: { note?: TripNote; onClose: () => void; onSave: (draft: ImmigrationDraft) => Promise<void> }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [summary, setSummary] = useState(note?.summary ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [saving, setSaving] = useState(false);
  return <Modal title={note ? "Edit immigration section" : "Add immigration section"} description="Use one line per point. For Q&A, write: Question || Answer." onClose={onClose} wide><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ section: IMMIGRATION_SECTION, title, summary: summary || undefined, body, icon: note?.icon, copyText: undefined, pronunciation: undefined, meaning: undefined }); setSaving(false); }}><label>Section title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="e.g. Arrival details"/></label><label>Highlighted answer <span className="optional">optional</span><input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={420} placeholder="A short answer to show prominently"/></label><label>Details<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} required placeholder="One point per line"/></label><div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save section"}</button></div></form></Modal>;
}
