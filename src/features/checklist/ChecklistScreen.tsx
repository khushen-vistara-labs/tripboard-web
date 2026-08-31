"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Filter, Heart, MapPin, Pencil, Plus, Search, ShoppingBag, SkipForward, Sparkles, Star, Trash2, Utensils } from "lucide-react";
import type { TripBoardData } from "../trip/use-tripboard-data";
import type { ChecklistItem, ChecklistKind, Priority } from "../../types/domain";
import { checklistProgress } from "./progress";
import { Modal } from "../../components/ui/Modal";

const kindOptions: { id: ChecklistKind | "ALL"; label: string; icon: typeof MapPin }[] = [
  { id: "ALL", label: "All", icon: Sparkles }, { id: "PLACE", label: "Places", icon: MapPin }, { id: "FOOD", label: "Food", icon: Utensils }, { id: "EXPERIENCE", label: "Experiences", icon: Star }, { id: "SHOPPING", label: "Shopping", icon: ShoppingBag },
];

export function ChecklistScreen({ data }: { data: TripBoardData }) {
  const [kind, setKind] = useState<ChecklistKind | "ALL">("ALL");
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  useEffect(() => { const queryKind = new URLSearchParams(window.location.search).get("kind"); if (queryKind && ["PLACE", "FOOD", "EXPERIENCE", "SHOPPING", "OTHER"].includes(queryKind)) queueMicrotask(() => setKind(queryKind as ChecklistKind)); }, []);
  const must = checklistProgress(data.checklist, "MUST");
  const optional = checklistProgress(data.checklist, "OPTIONAL");
  const categoryStats = kindOptions.slice(1).map((option) => ({ ...option, progress: checklistProgress(data.checklist.filter((item) => item.kind === option.id)) }));
  const filtered = useMemo(() => data.checklist.filter((item) => (kind === "ALL" || item.kind === kind) && (status === "ALL" || item.status === status) && (priority === "ALL" || item.priority === priority) && item.title.toLowerCase().includes(search.toLowerCase())), [data.checklist, kind, status, priority, search]);

  return <>
    <header className="screen-header"><div><p className="eyebrow">DON’T MISS A THING</p><h1>Checklist</h1><p>Places, foods, and experiences in one shared completion state.</p></div><button className="button primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Add item</button></header>

    <section className="completion-overview">
      <article className="must-progress"><div><span className="eyebrow">MUST COMPLETION</span><strong>{must.percent}%</strong><p>{must.completed} of {must.total} important items completed</p></div><div className="ring" style={{"--progress": `${must.percent * 3.6}deg`} as React.CSSProperties}><span>{must.completed}/{must.total}</span></div></article>
      <article><span className="eyebrow">OPTIONAL COMPLETED</span><strong>{optional.percent}%</strong><p>Kept separate so priorities stay honest.</p><div className="slim-progress"><i style={{width: `${optional.percent}%`}}/></div></article>
      <article className="remaining-callout"><Sparkles size={21}/><div><strong>{data.checklist.filter((item) => item.priority === "MUST" && item.status !== "COMPLETED").length} important things remain</strong><p>Use the remaining trip time deliberately.</p></div></article>
    </section>

    <div className="checklist-category-grid">{categoryStats.map((category) => { const Icon = category.icon; return <button key={category.id} className={kind === category.id ? "active" : ""} onClick={() => setKind(category.id)}><span><Icon size={18}/></span><div><strong>{category.label}</strong><small>{category.progress.completed} / {category.progress.total}</small></div><div className="mini-ring" style={{"--progress": `${category.progress.percent * 3.6}deg`} as React.CSSProperties}/></button>; })}</div>

    <section className="panel checklist-panel">
      <div className="checklist-toolbar"><div className="kind-tabs">{kindOptions.map((option) => <button className={kind === option.id ? "active" : ""} onClick={() => setKind(option.id)} key={option.id}>{option.label}</button>)}</div><div className="checklist-filters"><label className="search-field compact"><Search size={15}/><span className="sr-only">Search checklist</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search"/></label><label className="select-field small"><Filter size={14}/><select aria-label="Filter checklist status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Any status</option><option value="PLANNED">Not done</option><option value="COMPLETED">Completed</option><option value="SKIPPED">Skipped</option></select></label><label className="select-field small"><select aria-label="Filter priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority | "ALL")}><option value="ALL">Any priority</option><option value="MUST">Must</option><option value="WANT">Want</option><option value="OPTIONAL">Optional</option></select><ChevronDown size={14}/></label></div></div>
      {kind === "FOOD" && data.checklist.some((item) => item.kind === "FOOD" && item.priority === "MUST" && item.status !== "COMPLETED") && <div className="food-alert"><Utensils size={17}/><div><strong>Important foods still not tried</strong><p>Must-try food remains on the list. Completion is always explicit.</p></div></div>}
      <div className="checklist-list">{filtered.map((item) => <ChecklistRow item={item} key={item.id} onToggle={() => void data.toggleChecklist(item.id)} onEdit={() => setEditing(item)} onSkip={() => void data.editChecklistItem(item.id, { status: "SKIPPED" })} onDelete={() => { if (window.confirm(`Delete “${item.title}”?`)) void data.deleteChecklistItem(item.id); }}/>)}</div>
      {filtered.length === 0 && <div className="empty-state"><CheckCircle2 size={28}/><h3>{kind === "FOOD" ? "Everything in this food view is done 🎉" : "Nothing matches this view"}</h3><p>Try another category or clear the filters.</p></div>}
    </section>

    {showAdd && <ChecklistItemModal data={data} onClose={() => setShowAdd(false)} onSave={async (item) => { await data.addChecklistItem(item); setShowAdd(false); }}/>}
    {editing && <ChecklistItemModal data={data} initial={editing} onClose={() => setEditing(null)} onSave={async (item) => { await data.editChecklistItem(editing.id, item); setEditing(null); }}/>}
  </>;
}

function ChecklistRow({ item, onToggle, onEdit, onSkip, onDelete }: { item: ChecklistItem; onToggle: () => void; onEdit: () => void; onSkip: () => void; onDelete: () => void }) {
  const complete = item.status === "COMPLETED";
  const Icon = item.kind === "FOOD" ? Utensils : item.kind === "PLACE" ? MapPin : item.kind === "SHOPPING" ? ShoppingBag : Star;
  return <article className={`checklist-row ${complete ? "complete" : ""}`}><button className="check-button" onClick={onToggle} aria-label={`${complete ? "Mark incomplete" : "Mark complete"}: ${item.title}`}>{complete ? <CheckCircle2 size={23}/> : <Circle size={23}/>}</button><span className={`kind-icon kind-${item.kind.toLowerCase()}`}><Icon size={17}/></span><div className="checklist-content"><div><h3>{item.title}</h3>{item.favourite && <Heart className="favourite" size={14} fill="currentColor"/>}<span className={`priority-badge ${item.priority.toLowerCase()}`}>{item.priority}</span></div><p>{item.notes ?? item.neighbourhood ?? item.description ?? item.kind.toLowerCase()}{item.plannedDay ? ` · Planned ${new Date(`${item.plannedDay}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" })}` : ""}{item.targetCount > 1 ? ` · ${item.completedCount}/${item.targetCount}` : ""}</p></div><div className="checklist-row-actions"><button onClick={onEdit} aria-label={`Edit ${item.title}`}><Pencil size={15}/></button>{!complete && item.status !== "SKIPPED" && <button onClick={onSkip} aria-label={`Skip ${item.title}`}><SkipForward size={15}/></button>}<button onClick={onDelete} aria-label={`Delete ${item.title}`}><Trash2 size={15}/></button></div></article>;
}

function ChecklistItemModal({ data, initial, onClose, onSave }: { data: TripBoardData; initial?: ChecklistItem; onClose: () => void; onSave: (item: Parameters<TripBoardData["addChecklistItem"]>[0] & Partial<ChecklistItem>) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? ""); const [kind, setKind] = useState<ChecklistKind>(initial?.kind ?? "PLACE"); const [priority, setPriority] = useState<Priority>(initial?.priority ?? "WANT"); const [plannedDay, setPlannedDay] = useState(initial?.plannedDay ?? ""); const [notes, setNotes] = useState(initial?.notes ?? initial?.description ?? ""); const [targetCount, setTargetCount] = useState(initial?.targetCount?.toString() ?? "1"); const [rating, setRating] = useState(initial?.rating?.toString() ?? ""); const [favourite, setFavourite] = useState(initial?.favourite ?? false); const [linkedPlaceId, setLinkedPlaceId] = useState(initial?.linkedPlaceId ?? ""); const [saving, setSaving] = useState(false);
  return <Modal title={initial ? "Edit checklist item" : "Add to the shared checklist"} description="Notes, progress, favourites, and place links are shared." onClose={onClose} wide><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ title, kind, priority, plannedDay: plannedDay || undefined, notes: notes.trim() || undefined, targetCount: Number(targetCount), rating: rating ? Number(rating) : undefined, favourite, linkedPlaceId: linkedPlaceId || undefined }); setSaving(false); }}><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should you not miss?" required/></label><div className="form-grid"><label>Kind<select value={kind} onChange={(event) => setKind(event.target.value as ChecklistKind)}><option value="PLACE">Place</option><option value="FOOD">Food</option><option value="EXPERIENCE">Experience</option><option value="SHOPPING">Shopping</option><option value="OTHER">Other</option></select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="MUST">Must</option><option value="WANT">Want</option><option value="OPTIONAL">Optional</option></select></label><label>Target count<input type="number" min="1" value={targetCount} onChange={(event) => setTargetCount(event.target.value)}/></label><label>Rating <span className="optional">optional</span><select value={rating} onChange={(event) => setRating(event.target.value)}><option value="">Not rated</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label><label>Planned day<input type="date" value={plannedDay} onChange={(event) => setPlannedDay(event.target.value)}/></label><label>Linked place<select value={linkedPlaceId} onChange={(event) => setLinkedPlaceId(event.target.value)}><option value="">None</option>{data.places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div><label className="checkbox-field"><input type="checkbox" checked={favourite} onChange={(event) => setFavourite(event.target.checked)}/><Heart size={15}/> Favourite</label><label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="What to order, where to find it, or anything useful"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save item" : "Add item"}</button></div></form></Modal>;
}
