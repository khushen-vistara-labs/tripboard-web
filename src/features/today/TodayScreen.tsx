"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell, Check, ChevronRight, CircleDollarSign, Clock3, Compass, FileText, LocateFixed, Map, MoveRight, Navigation, Sparkles, Utensils, WalletCards } from "lucide-react";
import { DateTime } from "luxon";
import type { TripBoardData } from "../trip/use-tripboard-data";
import type { ItineraryItem } from "../../types/domain";
import { createLedger, postFinancialEvent, totalConsumption } from "../money/domain";
import { formatMoney } from "../../lib/currency/money";
import { rankWhatNow } from "../itinerary/rules";
import { Modal } from "../../components/ui/Modal";
import { MoveItemModal } from "../../components/app/MoveItemModal";

export function TodayScreen({ data }: { data: TripBoardData }) {
  const viewDate = data.demoMode ? "2026-12-28" : DateTime.now().setZone(data.trip.timezone).toISODate()!;
  const today = data.itinerary.filter((item) => item.date === viewDate).sort((a, b) => a.sequence - b.sequence);
  const pending = today.filter((item) => item.status === "PLANNED" || item.status === "MOVED");
  const completed = today.filter((item) => item.status === "COMPLETED").length;
  const next = pending[0];
  const [moveItem, setMoveItem] = useState<ItineraryItem | null>(null);
  const [showWhatNow, setShowWhatNow] = useState(false);
  const ledger = useMemo(() => data.financialEvents.reduce((state, event) => {
    try { return postFinancialEvent(state, event); } catch { return state; }
  }, createLedger(data.accounts)), [data.accounts, data.financialEvents]);
  const spentHkd = totalConsumption(ledger, "HKD");
  const foodToday = data.checklist.filter((item) => item.kind === "FOOD" && item.plannedDay === viewDate && item.status !== "COMPLETED");
  const label = DateTime.fromISO(viewDate, { zone: data.trip.timezone });
  const recommendations = rankWhatNow(data.itinerary, `${viewDate}T09:00:00+08:00`, data.trip.timezone).slice(0, 4);

  return <>
    <header className="topbar page-topbar">
      <div><p className="eyebrow">{label.toFormat("cccc, d LLLL").toUpperCase()}</p><h1>Good morning <span className="sun-glyph" aria-hidden="true">☀</span></h1></div>
      <div className="top-actions"><button className="icon-button" aria-label="View notifications"><Bell size={18}/><span className="notification-dot"/></button><div className="avatar" aria-label="Shared by two travellers">H<span>P</span></div></div>
    </header>

    <div className="day-heading">
      <div><span className="day-chip">DAY {Math.max(1, Math.floor(label.diff(DateTime.fromISO(data.trip.startDate), "days").days) + 1)}</span><h2>{viewDate === "2026-12-28" ? "Lantau & Tai O" : data.trip.name}</h2></div>
      <div className="progress-label"><strong>{completed} of {today.length}</strong><span>completed</span></div>
    </div>
    <div className="progress-track" aria-label={`${completed} of ${today.length} itinerary items completed`}><span style={{ width: `${today.length ? (completed / today.length) * 100 : 0}%` }}/></div>

    {next ? <article className="next-card">
      <div className="next-card-main">
        <div className="next-label"><span className="pulse"/> UP NEXT</div>
        <p className="next-time">{displayTime(next.plannedStartTime)}</p>
        <h3>{next.title}</h3>
        <p className="next-meta">{next.description ?? `${next.expectedDurationMinutes ?? 60} min · ${next.type}`}</p>
        {next.recommendedDepartureTime && <div className="leave-row"><span className="leave-icon"><Navigation size={15}/></span><div><small>RECOMMENDED DEPARTURE</small><strong>Leave by {displayTime(next.recommendedDepartureTime)}</strong></div><span className="countdown">in 42 min</span></div>}
        {next.transportInstructions && <p className="transport-note"><Map size={14}/>{next.transportInstructions}</p>}
        <div className="primary-actions">
          <button className="primary" onClick={() => void data.completeItinerary(next.id)}><Check size={16}/> Mark done</button>
          <button onClick={() => next.mapsUrl && window.open(next.mapsUrl, "_blank", "noopener,noreferrer")} disabled={!next.mapsUrl}><Navigation size={15}/> Directions</button>
          {next.bookingId && <a className="button-like" href={`/bookings?open=${next.bookingId}`}><FileText size={15}/> Ticket</a>}
          <button onClick={() => setMoveItem(next)}><MoveRight size={15}/> Move</button>
        </div>
      </div>
      <div className="next-visual" aria-hidden="true"><div className="sun"/><div className="mountain mountain-back"/><div className="mountain mountain-front"/><div className="cable"><i/><b>▣</b></div></div>
    </article> : <section className="empty-state celebration"><Check size={28}/><h2>Today’s plan is complete</h2><p>Everything scheduled for today has been resolved. Nice work.</p></section>}

    <div className="quick-strip">
      <button onClick={() => setShowWhatNow(true)}><span><Sparkles size={18}/></span><div><strong>What can we do now?</strong><small>Rank nearby unfinished plans</small></div><ChevronRight size={18}/></button>
      <a href="/money"><span><CircleDollarSign size={18}/></span><div><strong>Add a purchase</strong><small>Fast money entry</small></div><ChevronRight size={18}/></a>
    </div>

    <div className="dashboard-grid">
      <section className="panel schedule-panel">
        <div className="panel-heading"><h3>Coming up</h3><a href="/plan">View full plan <ChevronRight size={13}/></a></div>
        <div className="schedule-list">{pending.slice(1, 5).map((item) => <article key={item.id} className="schedule-item">
          <time>{displayTime(item.plannedStartTime)}</time><span className={`timeline-dot priority-${item.priority.toLowerCase()}`}/><div><strong>{item.title}</strong><p>{item.expectedDurationMinutes ?? 60} min · {item.priority}</p></div>
          <button onClick={() => void data.completeItinerary(item.id)} aria-label={`Mark ${item.title} done`}><Check size={17}/></button>
        </article>)}{pending.length <= 1 && <div className="mini-empty">Nothing else scheduled today.</div>}</div>
      </section>

      <aside className="right-rail">
        <section className="panel money-card"><div className="panel-heading"><h3>Today’s money</h3><a href="/money">Details <ChevronRight size={13}/></a></div><div className="money-total"><span>SPENT LOCALLY</span><strong>{formatMoney(spentHkd, "HKD", "en-HK")}</strong><small>of HK$650.00 planned</small></div><div className="money-progress"><span style={{ width: `${Math.min((Number(spentHkd) / 650) * 100, 100)}%` }}/></div><div className="money-footer"><span><Utensils size={12}/> Food <b>HK${ledger.localConsumption.HKD?.Food ?? 0}</b></span><span><Compass size={12}/> Transport <b>HK${ledger.localConsumption.HKD?.Transport ?? 0}</b></span><span><WalletCards size={12}/> Available <b>HK${ledger.balances["octopus-1"] ?? 0}</b></span></div></section>
        {foodToday.length > 0 && <section className="panel food-mini"><div className="panel-heading"><h3>Food still to try</h3><a href="/checklist?kind=FOOD">All food <ChevronRight size={13}/></a></div>{foodToday.slice(0, 3).map((food) => <button key={food.id} onClick={() => void data.toggleChecklist(food.id)}><span><Utensils size={14}/></span><div><strong>{food.title}</strong><small>{food.neighbourhood ?? "Planned today"}</small></div><span className="check-ring"/></button>)}</section>}
        <section className="warning-card"><span><AlertTriangle size={15}/></span><div><strong>2 items need attention</strong><p>Review activities that are overdue.</p></div><a href="/plan">Review</a></section>
      </aside>
    </div>

    {moveItem && <MoveItemModal item={moveItem} onClose={() => setMoveItem(null)} onMove={(date, time) => data.moveItinerary(moveItem.id, date, time)}/>} 
    {showWhatNow && <Modal title="What can we do now?" description="Rule-based suggestions from unfinished priorities, timing, and duration." onClose={() => setShowWhatNow(false)}>
      <div className="recommendation-list">{recommendations.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><small>{item.priority} · {item.expectedDurationMinutes ?? 60} min</small><strong>{item.title}</strong><p>{item.date === viewDate ? "Fits today’s plan" : `Planned ${DateTime.fromISO(item.date).toFormat("d LLL")}`}</p></div>{item.mapsUrl ? <button onClick={() => window.open(item.mapsUrl, "_blank", "noopener,noreferrer")} aria-label={`Directions to ${item.title}`}><LocateFixed size={17}/></button> : <Clock3 size={17}/>}</article>)}</div>
    </Modal>}
  </>;
}

function displayTime(value?: string) {
  if (!value) return "Flexible";
  return DateTime.fromFormat(value.slice(0, 5), "HH:mm").toFormat("h:mm a");
}
