"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import type { ItineraryItem } from "../../types/domain";

export function MoveItemModal({ item, onMove, onClose }: { item: ItineraryItem; onMove: (date: string, time?: string) => Promise<void>; onClose: () => void }) {
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.plannedStartTime ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  return <Modal title={`Move ${item.title}`} description="The activity stays connected to its checklist, booking, and history." onClose={onClose}>
    <form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onMove(date, time || undefined); setSaving(false); onClose(); }}>
      <label>Destination day<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label>
      <label>New time <span className="optional">optional</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)}/></label>
      <label>Reason <span className="optional">optional</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Rain, running late, venue closed…" rows={3}/></label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Moving…" : "Move activity"}</button></div>
    </form>
  </Modal>;
}
