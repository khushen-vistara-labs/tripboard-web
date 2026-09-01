"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Filter, GripVertical, MapPin, MoveRight, Pencil, Plus, RotateCcw, Search, SkipForward, Trash2 } from "lucide-react";
import { DateTime } from "luxon";
import type { TripBoardData } from "../trip/use-tripboard-data";
import type { ItineraryItem, Priority } from "../../types/domain";
import { MoveItemModal } from "../../components/app/MoveItemModal";
import { Modal } from "../../components/ui/Modal";
import type { EditableItineraryItem } from "../trip/use-tripboard-data";
import { reorderIds } from "./rules";
import { formatDuration } from "../../lib/dates/duration";

export function PlanScreen({ data }: { data: TripBoardData }) {
  const dates = useMemo(() => [...new Set([...data.days.map((day) => day.date), ...data.itinerary.map((item) => item.date)])].sort(), [data.days, data.itinerary]);
  const defaultDate = data.demoMode && dates.includes("2026-12-28") ? "2026-12-28" : dates[0];
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [moveItem, setMoveItem] = useState<ItineraryItem | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [editingDay, setEditingDay] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null); const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const allDayItems = data.itinerary.filter((item) => item.date === selectedDate).sort((a, b) => a.sequence - b.sequence);
  const items = allDayItems.filter((item) => (priority === "ALL" || item.priority === priority) && item.title.toLowerCase().includes(search.toLowerCase()));
  const completed = items.filter((item) => item.status === "COMPLETED").length;
  const currentIndex = dates.indexOf(selectedDate);
  const day = data.days.find((item) => item.date === selectedDate);
  const handledOpen = useRef(false);
  useEffect(() => { if (handledOpen.current) return; handledOpen.current = true; queueMicrotask(() => { const item = data.itinerary.find((entry) => entry.id === new URLSearchParams(window.location.search).get("open")); if (item) { setSelectedDate(item.date); setEditingItem(item); } }); }, [data.itinerary]);
  const proposeOrder = (sourceId: string, targetId: string) => {
    const reordered = reorderIds(allDayItems.map((item) => item.id), sourceId, targetId);
    if (reordered) setPendingOrder(reordered);
  };
  const nudge = (id: string, delta: -1 | 1) => { const ids = allDayItems.map((item) => item.id); const index = ids.indexOf(id); const target = index + delta; if (index < 0 || target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target], ids[index]]; setPendingOrder(ids); };

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
      <div className="plan-day-heading"><div><p>{selectedDate ? DateTime.fromISO(selectedDate).toFormat("cccc, d LLLL") : "No travel days"}</p><h2>{day?.title ?? "Trip day"}</h2>{day?.notes && <p className="day-notes">{day.notes}</p>}</div><div className="day-heading-actions"><span>{items.length} activities</span>{selectedDate && <button className="button secondary" onClick={() => setEditingDay(true)}><Pencil size={14}/> Edit day</button>}</div></div>
      <div className="plan-list">{items.map((item) => { const fullIndex = allDayItems.findIndex((entry) => entry.id === item.id); return <PlanRow key={item.id} item={item} dragging={draggingId === item.id} canMoveUp={fullIndex > 0} canMoveDown={fullIndex >= 0 && fullIndex < allDayItems.length - 1} onDragStart={(event) => { setDraggingId(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }} onDragEnd={() => setDraggingId(null)} onDrop={(event) => { event.preventDefault(); const sourceId = event.dataTransfer.getData("text/plain") || draggingId; if (sourceId) proposeOrder(sourceId, item.id); setDraggingId(null); }} onDone={() => void data.completeItinerary(item.id)} onReopen={() => void data.reopenItinerary(item.id)} onMove={() => setMoveItem(item)} onMoveUp={() => nudge(item.id, -1)} onMoveDown={() => nudge(item.id, 1)} onSkip={() => void data.skipItinerary(item.id)} onEdit={() => setEditingItem(item)} onDelete={() => { if (window.confirm(`Delete “${item.title}”?`)) void data.deleteItineraryItem(item.id); }}/>; })}</div>
      {items.length === 0 && <div className="empty-state"><CalendarDays size={27}/><h3>{allDayItems.length === 0 ? "No activities on this day yet" : "Nothing matches this view"}</h3><p>{allDayItems.length === 0 ? "Add the first activity, or edit the day title and notes above." : "Clear the filters to see the full day."}</p>{allDayItems.length === 0 && <button className="button primary" onClick={() => setAddingItem(true)}><Plus size={15}/> Add first activity</button>}</div>}
    </section>
    {moveItem && <MoveItemModal item={moveItem} onClose={() => setMoveItem(null)} onMove={(date, time, reason) => data.moveItinerary(moveItem.id, date, time, reason)}/>}
    {addingItem && <ActivityModal data={data} initialDate={selectedDate} onClose={() => setAddingItem(false)} onSave={async (item) => { await data.addItineraryItem(item); setAddingItem(false); }}/>}
    {editingItem && <ActivityModal data={data} initial={editingItem} onClose={() => setEditingItem(null)} onSave={async (item) => { await data.editItineraryItem(editingItem.id, item); setEditingItem(null); }}/>}
    {editingDay && <DayModal date={selectedDate} title={day?.title ?? "Trip day"} notes={day?.notes} onClose={() => setEditingDay(false)} onSave={async (title, notes) => { await data.saveDay({ date: selectedDate, title, notes }); setEditingDay(false); }}/>}
    {pendingOrder && <ReorderReasonModal onClose={() => setPendingOrder(null)} onSave={async (reason) => { await data.reorderItinerary(selectedDate, pendingOrder, reason); setPendingOrder(null); }}/>}
  </>;
}

function DayModal({ date, title: initialTitle, notes: initialNotes, onClose, onSave }: { date: string; title: string; notes?: string; onClose: () => void; onSave: (title: string, notes?: string) => Promise<void> }) {
  const [title, setTitle] = useState(initialTitle); const [notes, setNotes] = useState(initialNotes ?? ""); const [saving, setSaving] = useState(false);
  return <Modal title="Edit travel day" description={DateTime.fromISO(date).toFormat("cccc, d LLLL yyyy")} onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave(title.trim(), notes.trim() || undefined); setSaving(false); }}><label>Day title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="e.g. Lantau & Tai O"/></label><label>Shared notes <span className="optional">optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Weather plan, meeting point, or anything everyone should know"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save day"}</button></div></form></Modal>;
}

function PlanRow({ item, dragging, canMoveUp, canMoveDown, onDragStart, onDragEnd, onDrop, onDone, onReopen, onMove, onMoveUp, onMoveDown, onSkip, onEdit, onDelete }: { item: ItineraryItem; dragging: boolean; canMoveUp: boolean; canMoveDown: boolean; onDragStart: (event: React.DragEvent<HTMLElement>) => void; onDragEnd: () => void; onDrop: (event: React.DragEvent<HTMLElement>) => void; onDone: () => void; onReopen: () => void; onMove: () => void; onMoveUp: () => void; onMoveDown: () => void; onSkip: () => void; onEdit: () => void; onDelete: () => void }) {
  const finished = item.status === "COMPLETED";
  return <article className={`plan-row status-${item.status.toLowerCase()}${dragging ? " dragging" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={onDrop}>
    <button className="drag-handle" aria-label={`Reorder ${item.title}`}><GripVertical size={17}/></button>
    <time>{item.plannedStartTime ? DateTime.fromFormat(item.plannedStartTime.slice(0, 5), "HH:mm").toFormat("h:mm") : "Any"}<small>{item.plannedStartTime ? DateTime.fromFormat(item.plannedStartTime.slice(0, 5), "HH:mm").toFormat("a") : "time"}</small></time>
    <span className={`plan-node priority-${item.priority.toLowerCase()}`}>{finished ? <Check size={14}/> : null}</span>
    <div className="plan-row-content"><div className="plan-row-title"><h3>{item.title}</h3><span className={`priority-badge ${item.priority.toLowerCase()}`}>{item.priority}</span>{item.status === "MOVED" && <span className="moved-badge">Moved</span>}</div><p>{item.description ?? item.transportInstructions ?? `${item.type} · ${formatDuration(item.expectedDurationMinutes ?? 60)}`}</p><div className="plan-meta">{item.expectedDurationMinutes && <span><Clock3 size={13}/>{formatDuration(item.expectedDurationMinutes)}</span>}{item.mapsUrl && <a href={item.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13}/>Directions</a>}</div>{item.details && <TripDetails details={item.details}/>}</div>
    <div className="row-actions"><button onClick={onMoveUp} disabled={!canMoveUp} aria-label={`Move ${item.title} earlier`}><ArrowUp size={15}/><span>Earlier</span></button><button onClick={onMoveDown} disabled={!canMoveDown} aria-label={`Move ${item.title} later`}><ArrowDown size={15}/><span>Later</span></button>{finished ? <button className="done-action" onClick={onReopen} aria-label={`Mark ${item.title} not done`}><RotateCcw size={16}/><span>Undo done</span></button> : <button className="done-action" onClick={onDone}><Check size={16}/><span>Done</span></button>}<button onClick={onMove}><MoveRight size={16}/><span>Move day</span></button><button onClick={onEdit}><Pencil size={16}/><span>Edit</span></button>{!finished && <button onClick={onSkip}><SkipForward size={16}/><span>Skip</span></button>}<button onClick={onDelete} aria-label={`Delete ${item.title}`}><Trash2 size={16}/></button></div>
  </article>;
}

function TripDetails({ details }: { details: NonNullable<ItineraryItem["details"]> }) {
  const hasDetails = Object.values(details).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  if (!hasDetails) return null;
  return <details className="trip-details"><summary>Trip details</summary><div className="trip-details-grid">
    {details.quickNote && <Detail label="Remember" value={details.quickNote}/>} {details.booking && <Detail label="Booking" value={details.booking.replace("-", " ")}/>} {details.farePerPerson && <Detail label="Fare / person" value={details.farePerPerson}/>} {details.fareForTwo && <Detail label="Fare / two" value={details.fareForTwo}/>} {details.attractionCost && <Detail label="Attraction" value={details.attractionCost}/>} {details.payWith && <Detail label="Pay with" value={details.payWith}/>} {details.weather && <Detail label="Weather check" value={details.weather}/>} {details.fallback && <Detail label="Fallback" value={details.fallback}/>} {details.hotelReturn && <Detail label="Hotel return" value={details.hotelReturn}/>} {details.dietaryNote && <Detail label="Food safety" value={details.dietaryNote}/>} {details.foodNearby?.length && <Detail label="Nearby food" value={details.foodNearby.join(" · ")}/>} {details.carry?.length && <Detail label="Carry" value={details.carry.join(" · ")}/>}
    {details.transportOptions?.length ? <div className="detail-wide"><span>Transport choices</span>{details.transportOptions.map((option) => <p key={`${option.mode}-${option.label}`}><b>{option.mode}</b> · {option.label}{option.durationMinutes ? ` · ${formatDuration(option.durationMinutes)}` : ""}{option.cost ? ` · ${option.cost}` : ""}<br/>{option.instructions}</p>)}</div> : null}
  </div></details>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><p>{value}</p></div>; }

function ReorderReasonModal({ onClose, onSave }: { onClose: () => void; onSave: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(""); const [saving, setSaving] = useState(false);
  return <Modal title="Save the new order" description="A short reason makes the shared activity history useful." onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave(reason.trim()); setSaving(false); }}><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="Better walking route, booking time changed…"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save order"}</button></div></form></Modal>;
}

function ActivityModal({ data, initial, initialDate, onClose, onSave }: { data: TripBoardData; initial?: ItineraryItem; initialDate?: string; onClose: () => void; onSave: (item: EditableItineraryItem) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? initialDate ?? "");
  const [type, setType] = useState<EditableItineraryItem["type"]>(initial?.type ?? "activity");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "WANT");
  const [start, setStart] = useState(initial?.plannedStartTime ?? "");
  const [end, setEnd] = useState(initial?.plannedEndTime ?? "");
  const [duration, setDuration] = useState(initial?.expectedDurationMinutes?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.description ?? initial?.transportInstructions ?? "");
  const [placeId, setPlaceId] = useState(initial?.placeId ?? ""); const [bookingId, setBookingId] = useState(initial?.bookingId ?? ""); const [checklistItemId, setChecklistItemId] = useState(initial?.checklistItemId ?? "");
  const [saving, setSaving] = useState(false);

  return <Modal title={initial ? "Edit activity" : "Add activity"} description="Changes are shared with everyone on this trip." onClose={onClose} wide><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ title, date, type, priority, plannedStartTime: start || undefined, plannedEndTime: end || undefined, expectedDurationMinutes: duration ? Number(duration) : undefined, transportInstructions: notes || undefined, placeId: placeId || undefined, bookingId: bookingId || undefined, checklistItemId: checklistItemId || undefined }); setSaving(false); }}><label>Activity title<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="e.g. Victoria Harbour walk"/></label><div className="form-grid"><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label><label>Type<select value={type} onChange={(event) => setType(event.target.value as EditableItineraryItem["type"])}><option value="activity">Activity</option><option value="attraction">Attraction</option><option value="food">Food</option><option value="transport">Transport</option><option value="shopping">Shopping</option><option value="rest">Rest</option><option value="hotel">Hotel</option><option value="other">Other</option></select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="MUST">Must</option><option value="WANT">Want</option><option value="OPTIONAL">Optional</option></select></label></div><div className="form-grid"><label>Start time <span className="optional">optional</span><input type="time" value={start} onChange={(event) => setStart(event.target.value)}/></label><label>End time <span className="optional">optional</span><input type="time" value={end} onChange={(event) => setEnd(event.target.value)}/></label><label>Duration (minutes) <span className="optional">optional</span><input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)}/></label></div><div className="form-grid"><label>Linked place<select value={placeId} onChange={(event) => setPlaceId(event.target.value)}><option value="">None</option>{data.places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>Linked booking<select value={bookingId} onChange={(event) => setBookingId(event.target.value)}><option value="">None</option>{data.bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.title}</option>)}</select></label><label>Linked checklist item<select value={checklistItemId} onChange={(event) => setChecklistItemId(event.target.value)}><option value="">None</option>{data.checklist.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div><label>Notes and travel details <span className="optional">optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Anything the group should know"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Add activity"}</button></div></form></Modal>;
}
