"use client";

import { useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Check, ChevronRight, CircleDollarSign, Coins, CreditCard, History, Info, Landmark, Plus, ReceiptText, RefreshCcw, Search, SlidersHorizontal, WalletCards } from "lucide-react";
import type { TripBoardData } from "../trip/use-tripboard-data";
import { createLedger, FinancialInvariantError, postFinancialEvent, totalConsumption, type FinancialEvent, type FinancialEventType, type LedgerSnapshot, type PaymentAccount } from "./domain";
import { formatMoney } from "../../lib/currency/money";
import { Modal } from "../../components/ui/Modal";

const categories = ["Food", "Transport", "Attractions", "Shopping", "Telecom/eSIM", "Fees", "Miscellaneous"];
const eventChoices: { type: FinancialEventType; label: string; help: string; icon: typeof ReceiptText }[] = [
  { type: "PURCHASE", label: "Purchase", help: "Something you bought or used", icon: ReceiptText },
  { type: "FUND_WALLET", label: "Top up / transfer", help: "Move value between accounts", icon: ArrowLeftRight },
  { type: "CASH_EXCHANGE", label: "Exchange cash", help: "Record both currencies", icon: Banknote },
  { type: "PURCHASE_REFUND", label: "Refund", help: "Return a purchase or wallet value", icon: ArrowDownLeft },
  { type: "BALANCE_ADJUSTMENT", label: "Correct balance", help: "Reconcile a wallet", icon: RefreshCcw },
];

export function MoneyScreen({ data }: { data: TripBoardData }) {
  const [showAdd, setShowAdd] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const ledger = useMemo(() => buildLedger(data.accounts, data.financialEvents), [data.accounts, data.financialEvents]);
  const localHkd = totalConsumption(ledger, "HKD");
  const localMop = totalConsumption(ledger, "MOP");
  const history = [...data.financialEvents].reverse().filter((event) => (historyFilter === "ALL" || event.type === historyFilter) && event.description.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => { if (new URLSearchParams(window.location.search).get("action") === "add") setShowAdd(true); }, []);

  return <>
    <header className="screen-header money-header"><div><p className="eyebrow">SHARED FINANCES</p><h1>Money</h1><p>Funding, local consumption, and remaining value—kept separate.</p></div><button className="button primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Add money activity</button></header>

    <div className="money-explainer"><Info size={17}/><p><strong>No double-counting.</strong> Local spending explains where trip money is consumed. It is never added again to own-money outflow.</p></div>

    <section className="money-kpis">
      <article className="kpi-card outflow"><div className="kpi-icon"><ArrowUpRight/></div><div className="kpi-title"><span>OWN MONEY OUTFLOW</span><small>External sources</small></div><strong>{formatMoney(ledger.ownMoneyOutflowInr, "INR")}</strong><p>{ledger.hasEstimatedOutflow ? "Includes provisional card estimates" : "Settled and committed"}</p><div className="kpi-breakdown"><span><CreditCard size={14}/>Cards & cash funding</span><a href="#history">See history <ChevronRight size={13}/></a></div></article>
      <article className="kpi-card consumption"><div className="kpi-icon"><ReceiptText/></div><div className="kpi-title"><span>LOCAL CONSUMPTION</span><small>Goods & services</small></div><strong>{formatMoney(localHkd, "HKD", "en-HK")}</strong>{Number(localMop) > 0 && <p>{formatMoney(localMop, "MOP", "en-MO")} in Macau</p>}<div className="kpi-breakdown"><span><Coins size={14}/>Across {Object.keys(ledger.localConsumption.HKD ?? {}).length} categories</span><a href="#breakdown">Breakdown <ChevronRight size={13}/></a></div></article>
      <article className="kpi-card available"><div className="kpi-icon"><WalletCards/></div><div className="kpi-title"><span>MONEY STILL AVAILABLE</span><small>Tracked local wallets</small></div><strong>{formatMoney(storedBalanceByCurrency(ledger, data.accounts, "HKD"), "HKD", "en-HK")}</strong><p>{formatMoney(storedBalanceByCurrency(ledger, data.accounts, "MOP"), "MOP", "en-MO")} in MOP</p><div className="kpi-breakdown"><span><WalletCards size={14}/>{data.accounts.filter((account) => account.accountClass === "STORED_VALUE").length} active wallets</span><a href="#accounts">View accounts <ChevronRight size={13}/></a></div></article>
    </section>

    <div className="money-main-grid">
      <section className="panel consumption-panel" id="breakdown">
        <div className="panel-heading"><div><h2>Local consumption</h2><p>What the trip money paid for</p></div><span className="currency-chip">HKD</span></div>
        <div className="category-chart">{Object.entries(ledger.localConsumption.HKD ?? {}).sort(([, a], [, b]) => Number(b) - Number(a)).map(([category, value], index) => <div className="category-row" key={category}><span className={`category-swatch tone-${index % 5}`}/><div><strong>{category}</strong><div className="bar"><i className={`tone-${index % 5}`} style={{width: `${Math.min((Number(value) / Math.max(Number(localHkd), 1)) * 100, 100)}%`}}/></div></div><b>{formatMoney(value, "HKD", "en-HK")}</b></div>)}</div>
        <div className="consumption-total"><span>Total consumed locally</span><strong>{formatMoney(localHkd, "HKD", "en-HK")}</strong></div>
      </section>

      <section className="panel accounts-panel" id="accounts">
        <div className="panel-heading"><div><h2>Wallets & cash</h2><p>Physical balances tracked separately</p></div><button className="icon-button quiet" aria-label="Account settings"><SlidersHorizontal size={16}/></button></div>
        <div className="account-list">{data.accounts.filter((account) => account.accountClass === "STORED_VALUE").map((account, index) => <article key={account.id}><span className={`account-icon account-${index % 4}`}>{account.name.includes("Octopus") ? <CreditCard size={17}/> : <Banknote size={17}/>}</span><div><strong>{account.name}</strong><small>{account.currency} stored value</small></div><b>{formatMoney(ledger.balances[account.id] ?? "0", account.currency, account.currency === "MOP" ? "en-MO" : "en-HK")}</b></article>)}</div>
        <button className="inline-add"><Plus size={15}/> Add payment account</button>
      </section>
    </div>

    <section className="panel history-panel" id="history">
      <div className="panel-heading history-heading"><div><h2>Money history</h2><p>Purchases, transfers, refunds, and corrections</p></div><div className="history-tools"><label className="search-field compact"><Search size={15}/><span className="sr-only">Search money history</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search"/></label><select aria-label="Filter money history" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}><option value="ALL">All activity</option><option value="PURCHASE">Purchases</option><option value="FUND_WALLET">Top ups</option><option value="INTERNAL_TRANSFER">Transfers</option><option value="PURCHASE_REFUND">Refunds</option><option value="BALANCE_ADJUSTMENT">Corrections</option></select></div></div>
      <div className="ledger-list">{history.map((event) => <LedgerRow key={event.id} event={event} accounts={data.accounts} timezone={data.trip.timezone}/>)}</div>
      {history.length === 0 && <div className="empty-state"><History size={25}/><h3>No matching money activity</h3><p>Try a different search or filter.</p></div>}
    </section>

    {showAdd && <AddMoneyModal accounts={data.accounts} ledger={ledger} events={data.financialEvents} onClose={() => setShowAdd(false)} onRecord={data.recordFinancialEvent}/>} 
  </>;
}

function buildLedger(accounts: PaymentAccount[], events: FinancialEvent[]) {
  return events.reduce((ledger, event) => { try { return postFinancialEvent(ledger, event); } catch { return ledger; } }, createLedger(accounts));
}

function storedBalanceByCurrency(ledger: LedgerSnapshot, accounts: PaymentAccount[], currency: string) {
  return accounts.filter((account) => account.accountClass === "STORED_VALUE" && account.currency === currency).reduce((sum, account) => sum.plus(ledger.balances[account.id] ?? 0), new Decimal(0)).toString();
}

function LedgerRow({ event, accounts, timezone }: { event: FinancialEvent; accounts: PaymentAccount[]; timezone: string }) {
  const source = accounts.find((account) => account.id === event.sourceAccountId)?.name;
  const destination = accounts.find((account) => account.id === event.destinationAccountId)?.name;
  const purchase = event.type === "PURCHASE";
  const amount = purchase ? event.consumptionAmount : event.destinationAmount ?? event.sourceAmount;
  const currency = purchase ? event.consumptionCurrency : event.destinationCurrency ?? event.sourceCurrency;
  const Icon = purchase ? ReceiptText : event.type.includes("REFUND") ? ArrowDownLeft : event.type === "BALANCE_ADJUSTMENT" ? RefreshCcw : ArrowLeftRight;
  return <article className="ledger-row"><span className={`ledger-icon type-${event.type.toLowerCase()}`}><Icon size={16}/></span><div className="ledger-description"><strong>{event.description}</strong><small>{purchase ? `${event.category ?? "Miscellaneous"} · ${source}` : source && destination ? `${source} → ${destination}` : event.type.replaceAll("_", " ")}</small></div><div className="ledger-amount"><strong>{currency && amount ? formatMoney(amount, currency, currency === "INR" ? "en-IN" : "en-HK") : "—"}</strong><span className={`event-label ${purchase ? "spend" : "move"}`}>{purchase ? "Consumption" : event.type === "BALANCE_ADJUSTMENT" ? "Correction" : "Transfer"}</span></div><time>{new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(event.occurredAt))}</time></article>;
}

function AddMoneyModal({ accounts, ledger, events, onClose, onRecord }: { accounts: PaymentAccount[]; ledger: LedgerSnapshot; events: FinancialEvent[]; onClose: () => void; onRecord: (event: FinancialEvent) => Promise<void> }) {
  const [type, setType] = useState<FinancialEventType | null>(null);
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState("");
  const [currency, setCurrency] = useState("HKD");
  const [sourceId, setSourceId] = useState(accounts.find((account) => account.accountClass === "STORED_VALUE")?.id ?? accounts[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState(accounts.find((account) => account.accountClass === "STORED_VALUE")?.id ?? "");
  const [category, setCategory] = useState("Food");
  const [description, setDescription] = useState("");
  const [settledInr, setSettledInr] = useState("");
  const [originalId, setOriginalId] = useState(events.find((event) => event.type === "PURCHASE")?.id ?? "");
  const [actualBalance, setActualBalance] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const source = accounts.find((account) => account.id === sourceId);
  const destination = accounts.find((account) => account.id === destinationId);

  if (!type) return <Modal title="What happened?" description="Choose the real-world activity. TripBoard handles the accounting." onClose={onClose}>
    <div className="activity-choice-list">{eventChoices.map((choice) => { const Icon = choice.icon; return <button key={choice.type} onClick={() => { setType(choice.type); if (choice.type === "FUND_WALLET" || choice.type === "CASH_EXCHANGE") { setSourceId(accounts.find((account) => account.accountClass === "EXTERNAL_SOURCE")?.id ?? ""); setDestinationId(accounts.find((account) => account.accountClass === "STORED_VALUE")?.id ?? ""); } }}><span><Icon size={19}/></span><div><strong>{choice.label}</strong><small>{choice.help}</small></div><ChevronRight size={17}/></button>; })}</div>
  </Modal>;

  const selectedChoice = eventChoices.find((choice) => choice.type === type)!;
  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault(); setFormError("");
    try {
      const value = new Decimal(type === "BALANCE_ADJUSTMENT" ? actualBalance || 0 : amount || 0);
      if (value.isNegative() || value.isZero()) throw new Error("Enter an amount greater than zero.");
      const id = crypto.randomUUID();
      const base: FinancialEvent = { id, idempotencyKey: id, type, occurredAt: new Date().toISOString(), description: description || selectedChoice.label };
      let next: FinancialEvent;
      if (type === "PURCHASE") next = { ...base, sourceAccountId: sourceId, sourceAmount: amount, sourceCurrency: currency, consumptionAmount: amount, consumptionCurrency: currency, category, settledInrAmount: source?.accountClass === "EXTERNAL_SOURCE" && settledInr ? settledInr : undefined, settlementStatus: settledInr ? "SETTLED" : undefined };
      else if (type === "FUND_WALLET") next = source?.accountClass === "STORED_VALUE" && destination?.accountClass === "STORED_VALUE" ? { ...base, type: "INTERNAL_TRANSFER", sourceAccountId: sourceId, destinationAccountId: destinationId, sourceAmount: amount, sourceCurrency: source.currency, destinationAmount: destinationAmount || amount, destinationCurrency: destination.currency } : { ...base, sourceAccountId: sourceId, destinationAccountId: destinationId, destinationAmount: destinationAmount || amount, destinationCurrency: destination?.currency ?? currency, settledInrAmount: settledInr || undefined, settlementStatus: settledInr ? "SETTLED" : "PROVISIONAL" };
      else if (type === "CASH_EXCHANGE") next = { ...base, sourceAccountId: sourceId, destinationAccountId: destinationId, sourceAmount: amount, sourceCurrency: source?.currency ?? "INR", destinationAmount, destinationCurrency: destination?.currency ?? currency, settledInrAmount: source?.currency === "INR" ? amount : settledInr };
      else if (type === "PURCHASE_REFUND") { const original = events.find((event) => event.id === originalId); next = { ...base, originalTransactionId: originalId, destinationAccountId: destinationId, destinationAmount: amount, destinationCurrency: original?.consumptionCurrency ?? currency, consumptionAmount: amount, consumptionCurrency: original?.consumptionCurrency ?? currency, category: original?.category }; }
      else {
        const current = new Decimal(ledger.balances[destinationId] ?? 0); const adjustment = value.minus(current);
        next = { ...base, destinationAccountId: destinationId, destinationAmount: adjustment.toString(), destinationCurrency: destination?.currency ?? currency };
      }
      postFinancialEvent(ledger, next);
      setSaving(true); await onRecord(next); setSaving(false); onClose();
    } catch (error) { setSaving(false); setFormError(error instanceof FinancialInvariantError || error instanceof Error ? error.message : "Could not record this activity."); }
  };

  return <Modal title={selectedChoice.label} description={type === "FUND_WALLET" || type === "CASH_EXCHANGE" ? "This moves money. It does not count as local spending." : undefined} onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      {type !== "BALANCE_ADJUSTMENT" && type !== "PURCHASE_REFUND" && <label>Paid / moved from<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); const account = accounts.find((item) => item.id === event.target.value); if (account) setCurrency(account.currency === "INR" && type === "PURCHASE" ? "HKD" : account.currency); }}>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>}
      {type === "PURCHASE_REFUND" && <label>Original purchase<select value={originalId} onChange={(event) => setOriginalId(event.target.value)}>{events.filter((event) => event.type === "PURCHASE").map((event) => <option value={event.id} key={event.id}>{event.description} · {event.consumptionCurrency} {event.consumptionAmount}</option>)}</select></label>}
      {(type === "FUND_WALLET" || type === "CASH_EXCHANGE" || type === "PURCHASE_REFUND" || type === "BALANCE_ADJUSTMENT") && <label>{type === "BALANCE_ADJUSTMENT" ? "Account" : "To"}<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{accounts.filter((account) => type === "PURCHASE_REFUND" || type === "BALANCE_ADJUSTMENT" ? account.accountClass === "STORED_VALUE" : account.id !== sourceId && (type === "FUND_WALLET" ? true : account.accountClass === "STORED_VALUE")).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>}
      {type === "BALANCE_ADJUSTMENT" ? <label>Actual balance<div className="amount-input"><span>{destination?.currency ?? currency}</span><input inputMode="decimal" value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} placeholder={ledger.balances[destinationId] ?? "0"} required/></div><small className="field-help">TripBoard currently expects {destination?.currency} {ledger.balances[destinationId] ?? 0}. The difference becomes an uncategorised correction.</small></label> : <label>{type === "PURCHASE" ? "Amount" : type === "PURCHASE_REFUND" ? "Refund amount" : "Source amount"}<div className="amount-input"><span>{type === "PURCHASE_REFUND" ? events.find((event) => event.id === originalId)?.consumptionCurrency ?? currency : source?.currency === "INR" && type === "PURCHASE" ? currency : source?.currency ?? currency}</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required/></div></label>}
      {(type === "FUND_WALLET" || type === "CASH_EXCHANGE") && <label>Destination amount<div className="amount-input"><span>{destination?.currency ?? currency}</span><input inputMode="decimal" value={destinationAmount} onChange={(event) => setDestinationAmount(event.target.value)} placeholder="0.00" required={type === "CASH_EXCHANGE"}/></div></label>}
      {type === "PURCHASE" && <><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>HKD</option><option>MOP</option><option>INR</option></select></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></>}
      {((type === "PURCHASE" && source?.accountClass === "EXTERNAL_SOURCE") || (type === "FUND_WALLET" && source?.accountClass === "EXTERNAL_SOURCE")) && <label>Actual INR charge <span className="optional">optional for now</span><div className="amount-input"><span>INR</span><input inputMode="decimal" value={settledInr} onChange={(event) => setSettledInr(event.target.value)} placeholder="Enter after settlement"/></div></label>}
      <label>Description <span className="optional">optional</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === "PURCHASE" ? "Merchant or item" : selectedChoice.label}/></label>
      {type !== "PURCHASE" && type !== "BALANCE_ADJUSTMENT" && <div className="transfer-callout"><ArrowLeftRight size={16}/><span>This is a money movement, not local consumption.</span></div>}
      {formError && <div className="form-error" role="alert">{formError}</div>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={() => setType(null)}>Back</button><button className="button primary" disabled={saving}><Check size={16}/>{saving ? "Saving…" : "Record activity"}</button></div>
    </form>
  </Modal>;
}
