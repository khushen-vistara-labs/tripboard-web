"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Filter, GripVertical, MapPin, MoveRight, Pencil, Plus, Search, SkipForward, Trash2 } from "lucide-react";
import { DateTime } from "luxon";
import type { TripBoardData } from "../trip/use-tripboard-data";
import type { ItineraryItem, Priority } from "../../types/domain";
import { MoveItemModal } from "../../components/app/MoveItemModal";
import { Modal } from "../../components/ui/Modal";
import type { EditableItineraryItem } from "../trip/use-tripboard-data";

export function PlanScreen({ data }: { data: TripBoardData }) {
  const dates = useMemo(() => [...new Set(data.itinerary.map((item) => item.date))].sort(), [data.itinerary]);
  const defaultDate = data.demoMode && dates.includes("2026-12-28") ? "2026-12-28" : dates[0];
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [moveItem, setMoveItem] = useState<ItineraryItem | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const items = data.itinerary.filter((item) => item.date === selectedDate && (priority === "ALL" || item.priority === priority) && item.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.sequence - b.sequence);
  const completed = items.filter((item) => item.status === "COMPLETED").length;
  const currentIndex = dates.indexOf(selectedDate);

  return <>
    <header className="screen-header">
      <div><p className="eyebrow">SHARED ITINERARY</p><h1>Plan</h1><p>Shape the days together. Every change stays shared.</p></div>
      <button className="button primary" onClick={() => setAddingItem(true)}><Plus size={17}/> Add activity</button>
    </header>

    <div className="date-navigator panel">
      <button aria-label="Previous day" disabled={currentIndex <= 0} onClick={() => setSelectedDate(dates[currentIndex - 1])}><ChevronLeft/></button>
      <div className="date-tabs" role="tablist" aria-label="Trip days">{dates.map((date, index) => { const parsed = DateTime.fromISO(date); return <button role="tab" aria-selected={selectedDate === date} className={selectedDate === date ? "active" : ""} key={date} onClick={() => setSelectedDate(date)}><span>Day {index + 1}</span><strong>{parsed.toFormat("d")}</strong><small>{parsed.toFormat("ccc")}</small></button>; })}</div>
      <button aria-label="Next day" disabled={currentIndex < 0 || currentIndex >= dates.length - 1} onClick={() => setSelectedDate(dates[currentIndex + 1])}><ChevronRight/></button>
    </div>

    <div className="toolbar-row">
      <label className="search-field"><Search size={16}/><span className="sr-only">Search itinerary</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this day"/></label>
      <label className="select-field"><Filter size={15}/><span className="sr-only">Filter priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority | "ALL")}><option value="ALL">All priorities</option><option value="MUST">Must do</option><option value="WANT">Want to do</option><option value="OPTIONAL">Optional</option></select></label>
      <div className="day-progress"><span>{completed}/{items.length} complete</span><div><i style={{width: `${items.length ? completed / items.length * 100 : 0}%`}}/></div></div>
    </div>

    <section className="plan-day panel">
      <div className="plan-day-heading"><div><p>{DateTime.fromISO(selectedDate).toFormat("cccc, d LLLL")}</p><h2>{selectedDate === "2026-12-28" ? "Lantau & Tai O" : "Trip day"}</h2></div><span>{items.length} activities</span></div>
      <div className="plan-list">{items.map((item) => <PlanRow key={item.id} item={item} onDone={() => void data.completeItinerary(item.id)} onMove={() => setMoveItem(item)} onSkip={() => void data.skipItinerary(item.id)} onEdit={() => setEditingItem(item)} onDelete={() => { if (window.confirm(`Delete “${item.title}”?`)) void data.deleteItineraryItem(item.id); }}/>)}</div>
      {items.length === 0 && <div className="empty-state"><CalendarDays size={27}/><h3>Nothing matches this view</h3><p>Clear the filters or add an activity for this day.</p></div>}
    </section>
    {moveItem && <MoveItemModal item={moveItem} onClose={() => setMoveItem(null)} onMove={(date, time) => data.moveItinerary(moveItem.id, date, time)}/>} 
    {addingItem && <ActivityModal initialDate={selectedDate} onClose={() => setAddingItem(false)} onSave={async (item) => { await data.addItineraryItem(item); setAddingItem(false); }}/>} 
    {editingItem && <ActivityModal initial={editingItem} onClose={() => setEditingItem(null)} onSave={async (item) => { await data.editItineraryItem(editingItem.id, item); setEditingItem(null); }}/>} 
  </>;
}

function PlanRow({ item, onDone, onMove, onSkip, onEdit, onDelete }: { item: ItineraryItem; onDone: () => void; onMove: () => void; onSkip: () => void; onEdit: () => void; onDelete: () => void }) {
  const finished = item.status === "COMPLETED";
  return <article className={`plan-row status-${item.status.toLowerCase()}`}>
    <button className="drag-handle" aria-label={`Reorder ${item.title}`}><GripVertical size={17}/></button>
    <time>{item.plannedStartTime ? DateTime.fromFormat(item.plannedStartTime.slice(0, 5), "HH:mm").toFormat("h:mm") : "Any"}<small>{item.plannedStartTime ? DateTime.fromFormat(item.plannedStartTime.slice(0, 5), "HH:mm").toFormat("a") : "time"}</small></time>
    <span className={`plan-node priority-${item.priority.toLowerCase()}`}>{finished ? <Check size={14}/> : null}</span>
    <div className="plan-row-content"><div className="plan-row-title"><h3>{item.title}</h3><span className={`priority-badge ${item.priority.toLowerCase()}`}>{item.priority}</span>{item.status === "MOVED" && <span className="moved-badge">Moved</span>}</div><p>{item.description ?? item.transportInstructions ?? `${item.type} · ${item.expectedDurationMinutes ?? 60} min`}</p><div className="plan-meta">{item.expectedDurationMinutes && <span><Clock3 size={13}/>{item.expectedDurationMinutes} min</span>}{item.mapsUrl && <a href={item.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13}/>Directions</a>}</div></div>
    <div className="row-actions">{!finished && <button className="done-action" onClick={onDone}><Check size={16}/><span>Done</span></button>}<button onClick={onMove}><MoveRight size={16}/><span>Move</span></button><button onClick={onEdit}><Pencil size={16}/><span>Edit</span></button>{!finished && <button onClick={onSkip}><SkipForward size={16}/><span>Skip</span></button>}<button onClick={onDelete} aria-label={`Delete ${item.title}`}><Trash2 size={16}/></button></div>
  </article>;
}

function ActivityModal({ initial, initialDate, onClose, onSave }: { initial?: ItineraryItem; initialDate?: string; onClose: () => void; onSave: (item: EditableItineraryItem) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? initialDate ?? "");
  const [type, setType] = useState<EditableItineraryItem["type"]>(initial?.type ?? "activity");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "WANT");
  const [start, setStart] = useState(initial?.plannedStartTime ?? "");
  const [end, setEnd] = useState(initial?.plannedEndTime ?? "");
  const [duration, setDuration] = useState(initial?.expectedDurationMinutes?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.description ?? initial?.transportInstructions ?? "");
  const [saving, setSaving] = useState(false);

  return <Modal title={initial ? "Edit activity" : "Add activity"} description="Changes are shared with everyone on this trip." onClose={onClose} wide><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ title, date, type, priority, plannedStartTime: start || undefined, plannedEndTime: end || undefined, expectedDurationMinutes: duration ? Number(duration) : undefined, transportInstructions: notes || undefined }); setSaving(false); }}><label>Activity title<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="e.g. Victoria Harbour walk"/></label><div className="form-grid"><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label><label>Type<select value={type} onChange={(event) => setType(event.target.value as EditableItineraryItem["type"])}><option value="activity">Activity</option><option value="attraction">Attraction</option><option value="food">Food</option><option value="transport">Transport</option><option value="shopping">Shopping</option><option value="rest">Rest</option><option value="hotel">Hotel</option><option value="other">Other</option></select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="MUST">Must</option><option value="WANT">Want</option><option value="OPTIONAL">Optional</option></select></label></div><div className="form-grid"><label>Start time <span className="optional">optional</span><input type="time" value={start} onChange={(event) => setStart(event.target.value)}/></label><label>End time <span className="optional">optional</span><input type="time" value={end} onChange={(event) => setEnd(event.target.value)}/></label><label>Duration (minutes) <span className="optional">optional</span><input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)}/></label></div><label>Notes and travel details <span className="optional">optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Anything the group should know"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Add activity"}</button></div></form></Modal>;
}
