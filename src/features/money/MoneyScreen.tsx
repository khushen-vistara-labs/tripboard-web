"use client";
/* eslint-disable jsx-a11y/no-autofocus -- account modal opens directly into its name field */

import { useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { Archive, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Check, ChevronRight, Coins, CreditCard, History, Info, Pencil, Plus, ReceiptText, RefreshCcw, Search, SlidersHorizontal, Trash2, WalletCards } from "lucide-react";
import type { TripBoardData } from "../trip/use-tripboard-data";
import { createLedger, FinancialInvariantError, postFinancialEvent, totalConsumption, type FinancialEvent, type FinancialEventType, type LedgerSnapshot, type PaymentAccount } from "./domain";
import { formatMoney } from "../../lib/currency/money";
import { Modal } from "../../components/ui/Modal";
import type { Budget } from "../../types/domain";
import { budgetLabel, calculateBudgetUsage } from "../budgets/usage";

const categories = ["Food", "Transport", "Attractions", "Accommodation", "Shopping", "Telecom/eSIM", "Fees", "Miscellaneous"];
const eventChoices: { type: FinancialEventType; label: string; help: string; icon: typeof ReceiptText }[] = [
  { type: "PURCHASE", label: "Purchase", help: "Something you bought or used", icon: ReceiptText },
  { type: "FUND_WALLET", label: "Top up / transfer", help: "Move value between accounts", icon: ArrowLeftRight },
  { type: "CASH_EXCHANGE", label: "Exchange cash", help: "Record both currencies", icon: Banknote },
  { type: "PURCHASE_REFUND", label: "Refund", help: "Return a purchase or wallet value", icon: ArrowDownLeft },
  { type: "BALANCE_ADJUSTMENT", label: "Correct balance", help: "Reconcile a wallet", icon: RefreshCcw },
];

export function MoneyScreen({ data }: { data: TripBoardData }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [settling, setSettling] = useState<FinancialEvent | null>(null);
  const [voiding, setVoiding] = useState<FinancialEvent | null>(null);
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const activeAccounts = data.accounts.filter((account) => !account.archivedAt);
  const activeEvents = data.financialEvents.filter((event) => !event.voidedAt);
  const ledger = useMemo(() => buildLedger(data.accounts, activeEvents), [data.accounts, activeEvents]);
  const localHkd = totalConsumption(ledger, "HKD");
  const localMop = totalConsumption(ledger, "MOP");
  const history = [...data.financialEvents].reverse().filter((event) => (historyFilter === "ALL" || event.type === historyFilter) && event.description.toLowerCase().includes(search.toLowerCase()));
  const provisional = activeEvents.filter((event) => event.settlementStatus === "PROVISIONAL" && event.estimatedInrAmount);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("action") === "add") queueMicrotask(() => setShowAdd(true)); }, []);

  return <>
    <header className="screen-header money-header"><div><p className="eyebrow">SHARED FINANCES</p><h1>Money</h1><p>Funding, local consumption, and remaining value kept separate.</p></div><div className="header-actions"><a className="button secondary" href="#budgets">Manage budgets</a><button className="button primary" disabled={activeAccounts.length === 0} onClick={() => setShowAdd(true)}><Plus size={17}/> Add money activity</button></div></header>

    <div className="money-explainer"><Info size={17}/><p><strong>No double-counting.</strong> Local spending explains where trip money is consumed. It is never added again to own-money outflow.</p></div>

    <section className="money-kpis">
      <article className="kpi-card outflow"><div className="kpi-icon"><ArrowUpRight/></div><div className="kpi-title"><span>OWN MONEY OUTFLOW</span><small>External sources</small></div><strong>{formatMoney(ledger.ownMoneyOutflowInr, "INR")}</strong><p>{ledger.hasEstimatedOutflow ? "Includes provisional card estimates" : "Settled and committed"}</p><div className="kpi-breakdown"><span><CreditCard size={14}/>Cards & cash funding</span><a href="#history">See history <ChevronRight size={13}/></a></div></article>
      <article className="kpi-card consumption"><div className="kpi-icon"><ReceiptText/></div><div className="kpi-title"><span>LOCAL CONSUMPTION</span><small>Goods & services</small></div><strong>{formatMoney(localHkd, "HKD", "en-HK")}</strong>{Number(localMop) > 0 && <p>{formatMoney(localMop, "MOP", "en-MO")} in Macau</p>}<div className="kpi-breakdown"><span><Coins size={14}/>Across {Object.keys(ledger.localConsumption.HKD ?? {}).length} categories</span><a href="#breakdown">Breakdown <ChevronRight size={13}/></a></div></article>
      <article className="kpi-card available"><div className="kpi-icon"><WalletCards/></div><div className="kpi-title"><span>MONEY STILL AVAILABLE</span><small>Tracked local wallets</small></div><strong>{formatMoney(storedBalanceByCurrency(ledger, activeAccounts, "HKD"), "HKD", "en-HK")}</strong><p>{formatMoney(storedBalanceByCurrency(ledger, activeAccounts, "MOP"), "MOP", "en-MO")} in MOP</p><div className="kpi-breakdown"><span><WalletCards size={14}/>{activeAccounts.filter((account) => account.accountClass === "STORED_VALUE").length} active wallets</span><a href="#accounts">View accounts <ChevronRight size={13}/></a></div></article>
    </section>

    <div className="money-main-grid">
      <section className="panel consumption-panel" id="breakdown">
        <div className="panel-heading"><div><h2>Local consumption</h2><p>What the trip money paid for</p></div><span className="currency-chip">HKD</span></div>
        <div className="category-chart">{Object.entries(ledger.localConsumption.HKD ?? {}).sort(([, a], [, b]) => Number(b) - Number(a)).map(([category, value], index) => <div className="category-row" key={category}><span className={`category-swatch tone-${index % 5}`}/><div><strong>{category}</strong><div className="bar"><i className={`tone-${index % 5}`} style={{width: `${Math.min((Number(value) / Math.max(Number(localHkd), 1)) * 100, 100)}%`}}/></div></div><b>{formatMoney(value, "HKD", "en-HK")}</b></div>)}</div>
        {Object.keys(ledger.localConsumption.HKD ?? {}).length === 0 && <div className="mini-empty">No local purchases have been recorded yet.</div>}
        <div className="consumption-total"><span>Total consumed locally</span><strong>{formatMoney(localHkd, "HKD", "en-HK")}</strong></div>
      </section>

      <section className="panel accounts-panel" id="accounts">
        <div className="panel-heading"><div><h2>Payment accounts</h2><p>Cards, cash, and stored-value wallets</p></div><SlidersHorizontal size={16}/></div>
        <div className="account-list">{activeAccounts.map((account, index) => <article key={account.id}><span className={`account-icon account-${index % 4}`}>{account.accountClass === "EXTERNAL_SOURCE" ? <CreditCard size={17}/> : <Banknote size={17}/>}</span><div><strong>{account.name}</strong><small>{account.accountClass === "STORED_VALUE" ? `${account.currency} ${account.accountType?.toLowerCase() ?? "stored value"}` : `${account.currency} ${account.accountType?.replaceAll("_", " ").toLowerCase() ?? "funding source"}`}</small></div>{account.accountClass === "STORED_VALUE" && <b>{formatMoney(ledger.balances[account.id] ?? "0", account.currency, account.currency === "MOP" ? "en-MO" : "en-HK")}</b>}<span className="account-actions"><button aria-label={`Edit ${account.name}`} onClick={() => setEditingAccount(account)}><Pencil size={14}/></button><button aria-label={`Archive ${account.name}`} onClick={() => { if (window.confirm(`Archive “${account.name}”? Its transaction history will be preserved.`)) void data.archivePaymentAccount(account.id); }}><Archive size={14}/></button></span></article>)}</div>
        {activeAccounts.length === 0 && <div className="empty-state compact-empty"><WalletCards size={24}/><h3>No payment accounts yet</h3><p>Add a card, cash pocket, or travel wallet before recording money activity.</p></div>}
        <button className="inline-add" onClick={() => setShowAccount(true)}><Plus size={15}/> Add payment account</button>
      </section>
    </div>

    <section className="panel budgets-panel" id="budgets">
      <div className="panel-heading"><div><h2>Budgets</h2><p>Live usage from purchases and refunds in each budget’s currency</p></div><button className="button secondary" onClick={() => setShowBudget(true)}><Plus size={15}/> Add budget</button></div>
      <div className="budget-list">{data.budgets.map((budget) => { const usage = calculateBudgetUsage(budget, activeEvents, data.trip.timezone); return <article key={budget.id}><div className="budget-heading"><div><strong>{budgetLabel(budget)}</strong><small>{formatMoney(usage.spent, budget.currency)} of {formatMoney(usage.amount, budget.currency)}</small></div><b>{Math.round(usage.percent)}%</b></div><div className="budget-track" aria-label={`${Math.round(usage.percent)} percent used`}><span className={usage.percent >= 100 ? "over" : usage.percent >= 80 ? "warning" : ""} style={{ width: `${Math.min(usage.percent, 100)}%` }}/></div><div className="budget-footer"><span>{formatMoney(usage.remaining, budget.currency)} remaining</span><span><button aria-label={`Edit ${budgetLabel(budget)}`} onClick={() => setEditingBudget(budget)}><Pencil size={14}/></button><button aria-label={`Delete ${budgetLabel(budget)}`} onClick={() => { if (window.confirm(`Delete ${budgetLabel(budget).toLowerCase()}?`)) void data.deleteBudget(budget.id); }}><Trash2 size={14}/></button></span></div></article>; })}</div>
      {data.budgets.length === 0 && <div className="empty-state compact-empty"><Coins size={24}/><h3>No budgets yet</h3><p>Add a whole-trip, category, or daily limit to start tracking usage.</p><button className="button primary" onClick={() => setShowBudget(true)}>Set first budget</button></div>}
    </section>

    {provisional.length > 0 && <section className="panel settlement-panel"><div className="panel-heading"><div><h2>Settlement review</h2><p>Replace card estimates with the final INR amount from your statement</p></div><span className="currency-chip">{provisional.length} pending</span></div><div className="settlement-list">{provisional.map((event) => <article key={event.id}><div><strong>{event.description}</strong><small>Estimated {formatMoney(event.estimatedInrAmount ?? "0", "INR")}</small></div><button className="button secondary" onClick={() => setSettling(event)}>Enter final charge</button></article>)}</div></section>}

    <section className="panel history-panel" id="history">
      <div className="panel-heading history-heading"><div><h2>Money history</h2><p>Purchases, transfers, refunds, and corrections</p></div><div className="history-tools"><label className="search-field compact"><Search size={15}/><span className="sr-only">Search money history</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search"/></label><select aria-label="Filter money history" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}><option value="ALL">All activity</option><option value="PURCHASE">Purchases</option><option value="FUND_WALLET">Top ups</option><option value="INTERNAL_TRANSFER">Transfers</option><option value="PURCHASE_REFUND">Refunds</option><option value="BALANCE_ADJUSTMENT">Corrections</option></select></div></div>
      <div className="ledger-list">{history.map((event) => <LedgerRow key={event.id} event={event} accounts={data.accounts} timezone={data.trip.timezone} onSettle={() => setSettling(event)} onVoid={() => setVoiding(event)}/>)}</div>
      {history.length === 0 && <div className="empty-state"><History size={25}/><h3>{data.financialEvents.length === 0 ? "No money activity yet" : "No matching money activity"}</h3><p>{data.financialEvents.length === 0 ? "Add the first purchase, transfer, refund, or correction when you’re ready." : "Try a different search or filter."}</p></div>}
    </section>

    {showAdd && <AddMoneyModal accounts={activeAccounts} ledger={ledger} events={activeEvents} onClose={() => setShowAdd(false)} onRecord={data.recordFinancialEvent}/>}
    {showAccount && <PaymentAccountModal onClose={() => setShowAccount(false)} onSave={async (account) => { await data.addPaymentAccount(account); setShowAccount(false); }}/>}
    {editingAccount && <PaymentAccountModal account={editingAccount} lockStructure={data.financialEvents.some((event) => event.sourceAccountId === editingAccount.id || event.destinationAccountId === editingAccount.id)} onClose={() => setEditingAccount(null)} onSave={async (account) => { await data.editPaymentAccount(editingAccount.id, account); setEditingAccount(null); }}/>}
    {showBudget && <BudgetModal defaultCurrency={activeAccounts.find((account) => account.accountClass === "STORED_VALUE")?.currency ?? data.trip.baseCurrency} onClose={() => setShowBudget(false)} onSave={async (budget) => { await data.addBudget(budget); setShowBudget(false); }}/>}
    {editingBudget && <BudgetModal budget={editingBudget} defaultCurrency={editingBudget.currency} onClose={() => setEditingBudget(null)} onSave={async (budget) => { await data.editBudget(editingBudget.id, budget); setEditingBudget(null); }}/>}
    {settling && <SettlementModal event={settling} onClose={() => setSettling(null)} onSave={async (amount) => { await data.settleFinancialTransaction(settling.id, settling.version ?? 1, amount); setSettling(null); }}/>}
    {voiding && <VoidTransactionModal event={voiding} onClose={() => setVoiding(null)} onSave={async (reason) => { await data.voidFinancialTransaction(voiding.id, voiding.version ?? 1, reason); setVoiding(null); }}/>}
  </>;
}

function PaymentAccountModal({ account, lockStructure = false, onClose, onSave }: { account?: PaymentAccount; lockStructure?: boolean; onClose: () => void; onSave: (account: Omit<PaymentAccount, "id" | "archivedAt">) => Promise<void> }) {
  const [name, setName] = useState(account?.name ?? ""); const [kind, setKind] = useState<PaymentAccount["accountClass"]>(account?.accountClass ?? "EXTERNAL_SOURCE"); const [accountType, setAccountType] = useState(account?.accountType ?? "BANK_ACCOUNT"); const [currency, setCurrency] = useState(account?.currency ?? "INR"); const [openingBalance, setOpeningBalance] = useState(account?.openingBalance ?? "0"); const [issuingBank, setIssuingBank] = useState(account?.issuingBank ?? ""); const [network, setNetwork] = useState(account?.network ?? ""); const [lastFour, setLastFour] = useState(account?.lastFour ?? ""); const [saving, setSaving] = useState(false);
  const changeKind = (next: PaymentAccount["accountClass"]) => { setKind(next); setAccountType(next === "EXTERNAL_SOURCE" ? "BANK_ACCOUNT" : "WALLET"); if (!account) setCurrency(next === "EXTERNAL_SOURCE" ? "INR" : "HKD"); };
  return <Modal title={account ? "Edit payment account" : "Add payment account"} description="Add the actual INR bank account or credit card used for flights, rooms, and other bookings." onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ name: name.trim(), accountClass: kind, accountType, currency, issuingBank: issuingBank.trim() || undefined, network: network.trim() || undefined, lastFour: lastFour.trim() || undefined, billingCurrency: kind === "EXTERNAL_SOURCE" ? currency : undefined, openingBalance }); setSaving(false); }}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "EXTERNAL_SOURCE" ? "e.g. HDFC Regalia" : "e.g. Octopus 1"} required autoFocus/></label><div className="form-grid"><label>Account class<select value={kind} disabled={lockStructure} onChange={(event) => changeKind(event.target.value as PaymentAccount["accountClass"])}><option value="EXTERNAL_SOURCE">Bank account or card</option><option value="STORED_VALUE">Wallet or cash</option></select></label><label>Account type<select value={accountType} disabled={lockStructure} onChange={(event) => setAccountType(event.target.value)}>{kind === "EXTERNAL_SOURCE" ? <><option value="BANK_ACCOUNT">Bank account</option><option value="CREDIT_CARD">Credit card</option><option value="DEBIT_CARD">Debit / forex card</option></> : <><option value="WALLET">Wallet</option><option value="CASH">Cash</option><option value="OCTOPUS">Octopus</option></>}</select></label><label>Currency<select value={currency} disabled={lockStructure} onChange={(event) => setCurrency(event.target.value)}><option>INR</option><option>HKD</option><option>MOP</option></select></label></div>{kind === "EXTERNAL_SOURCE" && <div className="form-grid"><label>Bank or issuer <span className="optional">optional</span><input value={issuingBank} onChange={(event) => setIssuingBank(event.target.value)} placeholder="e.g. HDFC"/></label><label>Network <span className="optional">optional</span><input value={network} onChange={(event) => setNetwork(event.target.value)} placeholder="e.g. Visa"/></label><label>Last 4 digits <span className="optional">optional</span><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, ""))} placeholder="1234"/></label></div>}<label>Opening balance<div className="amount-input"><span>{currency}</span><input inputMode="decimal" value={openingBalance} disabled={lockStructure} onChange={(event) => setOpeningBalance(event.target.value)} required/></div><small className="field-help">{lockStructure ? "Type, currency, and opening balance are locked because this account has history. Use Correct balance for reconciliation." : "For bank accounts and cards, this is normally 0; activity records track spend without treating it as a travel wallet."}</small></label><button className="button primary full" disabled={saving}>{saving ? "Saving…" : account ? "Save account" : "Add account"}</button></form></Modal>;
}

function BudgetModal({ budget, defaultCurrency, onClose, onSave }: { budget?: Budget; defaultCurrency: string; onClose: () => void; onSave: (budget: Omit<Budget, "id" | "tripId">) => Promise<void> }) {
  const [amount, setAmount] = useState(budget?.amount ?? ""); const [currency, setCurrency] = useState(budget?.currency ?? defaultCurrency); const [scope, setScope] = useState<Budget["scope"]>(budget?.scope ?? "TRIP"); const [category, setCategory] = useState(budget?.category ?? "Food"); const [date, setDate] = useState(budget?.date ?? ""); const [saving, setSaving] = useState(false);
  return <Modal title={budget ? "Edit budget" : "Set a budget"} description="Usage includes purchases minus refunds in the selected currency." onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSave({ amount, currency, scope, category: scope === "CATEGORY" ? category : undefined, date: scope === "DAILY" ? date : undefined }); setSaving(false); }}><label>Budget amount<div className="amount-input"><span>{currency}</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required/></div></label><div className="form-grid"><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>HKD</option><option>MOP</option><option>INR</option></select></label><label>Applies to<select value={scope} onChange={(event) => setScope(event.target.value as Budget["scope"])}><option value="TRIP">Whole trip</option><option value="CATEGORY">Category</option><option value="DAILY">Specific day</option></select></label></div>{scope === "CATEGORY" && <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>}{scope === "DAILY" && <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label>}<button className="button primary full" disabled={saving}>{saving ? "Saving…" : budget ? "Save budget" : "Add budget"}</button></form></Modal>;
}

function SettlementModal({ event, onClose, onSave }: { event: FinancialEvent; onClose: () => void; onSave: (amount: string) => Promise<void> }) {
  const [amount, setAmount] = useState(event.settledInrAmount ?? ""); const [saving, setSaving] = useState(false);
  return <Modal title="Review final card charge" description={event.description} onClose={onClose}><form className="form-stack" onSubmit={async (formEvent) => { formEvent.preventDefault(); setSaving(true); await onSave(amount); setSaving(false); }}><div className="settlement-comparison"><span><small>Estimated</small><strong>{formatMoney(event.estimatedInrAmount ?? "0", "INR")}</strong></span><span><small>Final statement charge</small><strong>{amount ? formatMoney(amount, "INR") : "Not available"}</strong></span></div><label>Final INR charge<div className="amount-input"><span>INR</span><input inputMode="decimal" value={amount} onChange={(input) => setAmount(input.target.value)} placeholder="0.00" required/></div></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Mark settled"}</button></div></form></Modal>;
}

function VoidTransactionModal({ event, onClose, onSave }: { event: FinancialEvent; onClose: () => void; onSave: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(""); const [saving, setSaving] = useState(false);
  return <Modal title="Void money activity" description={`This preserves “${event.description}” in history and removes its financial effect.`} onClose={onClose}><form className="form-stack" onSubmit={async (formEvent) => { formEvent.preventDefault(); setSaving(true); await onSave(reason.trim()); setSaving(false); }}><label>Correction reason<textarea value={reason} onChange={(input) => setReason(input.target.value)} rows={3} required placeholder="Duplicate entry, wrong account, incorrect amount…"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button danger" disabled={saving}>{saving ? "Voiding…" : "Void activity"}</button></div></form></Modal>;
}

function buildLedger(accounts: PaymentAccount[], events: FinancialEvent[]) {
  return events.reduce((ledger, event) => { try { return postFinancialEvent(ledger, event); } catch { return ledger; } }, createLedger(accounts));
}

function storedBalanceByCurrency(ledger: LedgerSnapshot, accounts: PaymentAccount[], currency: string) {
  return accounts.filter((account) => account.accountClass === "STORED_VALUE" && account.currency === currency).reduce((sum, account) => sum.plus(ledger.balances[account.id] ?? 0), new Decimal(0)).toString();
}

function LedgerRow({ event, accounts, timezone, onSettle, onVoid }: { event: FinancialEvent; accounts: PaymentAccount[]; timezone: string; onSettle: () => void; onVoid: () => void }) {
  const source = accounts.find((account) => account.id === event.sourceAccountId)?.name;
  const destination = accounts.find((account) => account.id === event.destinationAccountId)?.name;
  const purchase = event.type === "PURCHASE";
  const amount = purchase ? event.consumptionAmount : event.destinationAmount ?? event.sourceAmount;
  const currency = purchase ? event.consumptionCurrency : event.destinationCurrency ?? event.sourceCurrency;
  const Icon = purchase ? ReceiptText : event.type.includes("REFUND") ? ArrowDownLeft : event.type === "BALANCE_ADJUSTMENT" ? RefreshCcw : ArrowLeftRight;
  return <article className={`ledger-row${event.voidedAt ? " voided" : ""}`}><span className={`ledger-icon type-${event.type.toLowerCase()}`}><Icon size={16}/></span><div className="ledger-description"><strong>{event.description}</strong><small>{event.voidedAt ? "Voided · no longer affects totals" : purchase ? `${event.category ?? "Miscellaneous"} · ${source}` : source && destination ? `${source} → ${destination}` : event.type.replaceAll("_", " ")}</small></div><div className="ledger-amount"><strong>{currency && amount ? formatMoney(amount, currency, currency === "INR" ? "en-IN" : "en-HK") : "Not available"}</strong><span className={`event-label ${purchase ? "spend" : "move"}`}>{event.settlementStatus === "PROVISIONAL" ? "Estimate" : purchase ? "Consumption" : event.type === "BALANCE_ADJUSTMENT" ? "Correction" : "Transfer"}</span></div><time>{new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(event.occurredAt))}</time><span className="ledger-actions">{!event.voidedAt && event.settlementStatus === "PROVISIONAL" && <button onClick={onSettle}>Settle</button>}{!event.voidedAt && <button onClick={onVoid}>Void</button>}</span></article>;
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
  const [estimatedInr, setEstimatedInr] = useState("");
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
      if (type === "PURCHASE") next = { ...base, sourceAccountId: sourceId, sourceAmount: amount, sourceCurrency: currency, consumptionAmount: amount, consumptionCurrency: currency, category, estimatedInrAmount: source?.accountClass === "EXTERNAL_SOURCE" && estimatedInr ? estimatedInr : undefined, settledInrAmount: source?.accountClass === "EXTERNAL_SOURCE" && settledInr ? settledInr : undefined, settlementStatus: settledInr ? "SETTLED" : estimatedInr ? "PROVISIONAL" : undefined };
      else if (type === "FUND_WALLET") next = source?.accountClass === "STORED_VALUE" && destination?.accountClass === "STORED_VALUE" ? { ...base, type: "INTERNAL_TRANSFER", sourceAccountId: sourceId, destinationAccountId: destinationId, sourceAmount: amount, sourceCurrency: source.currency, destinationAmount: destinationAmount || amount, destinationCurrency: destination.currency } : { ...base, sourceAccountId: sourceId, destinationAccountId: destinationId, destinationAmount: destinationAmount || amount, destinationCurrency: destination?.currency ?? currency, estimatedInrAmount: estimatedInr || undefined, settledInrAmount: settledInr || undefined, settlementStatus: settledInr ? "SETTLED" : estimatedInr ? "PROVISIONAL" : undefined };
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
      {type !== "BALANCE_ADJUSTMENT" && type !== "PURCHASE_REFUND" && <label>Paid / moved from<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); const account = accounts.find((item) => item.id === event.target.value); if (account) setCurrency(account.currency); }}>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>}
      {type === "PURCHASE_REFUND" && <label>Original purchase<select value={originalId} onChange={(event) => setOriginalId(event.target.value)}>{events.filter((event) => event.type === "PURCHASE").map((event) => <option value={event.id} key={event.id}>{event.description} · {event.consumptionCurrency} {event.consumptionAmount}</option>)}</select></label>}
      {(type === "FUND_WALLET" || type === "CASH_EXCHANGE" || type === "PURCHASE_REFUND" || type === "BALANCE_ADJUSTMENT") && <label>{type === "BALANCE_ADJUSTMENT" ? "Account" : "To"}<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{accounts.filter((account) => type === "PURCHASE_REFUND" || type === "BALANCE_ADJUSTMENT" ? account.accountClass === "STORED_VALUE" : account.id !== sourceId && (type === "FUND_WALLET" ? true : account.accountClass === "STORED_VALUE")).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>}
      {type === "BALANCE_ADJUSTMENT" ? <label>Actual balance<div className="amount-input"><span>{destination?.currency ?? currency}</span><input inputMode="decimal" value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} placeholder={ledger.balances[destinationId] ?? "0"} required/></div><small className="field-help">TripBoard currently expects {destination?.currency} {ledger.balances[destinationId] ?? 0}. The difference becomes an uncategorised correction.</small></label> : <label>{type === "PURCHASE" ? "Amount" : type === "PURCHASE_REFUND" ? "Refund amount" : "Source amount"}<div className="amount-input"><span>{type === "PURCHASE_REFUND" ? events.find((event) => event.id === originalId)?.consumptionCurrency ?? currency : source?.currency === "INR" && type === "PURCHASE" ? currency : source?.currency ?? currency}</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required/></div></label>}
      {(type === "FUND_WALLET" || type === "CASH_EXCHANGE") && <label>Destination amount<div className="amount-input"><span>{destination?.currency ?? currency}</span><input inputMode="decimal" value={destinationAmount} onChange={(event) => setDestinationAmount(event.target.value)} placeholder="0.00" required={type === "CASH_EXCHANGE"}/></div></label>}
      {type === "PURCHASE" && <><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>HKD</option><option>MOP</option><option>INR</option></select></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></>}
      {((type === "PURCHASE" && source?.accountClass === "EXTERNAL_SOURCE") || (type === "FUND_WALLET" && source?.accountClass === "EXTERNAL_SOURCE")) && <div className="form-grid"><label>Estimated INR charge <span className="optional">optional</span><div className="amount-input"><span>INR</span><input inputMode="decimal" value={estimatedInr} onChange={(event) => setEstimatedInr(event.target.value)} placeholder="Pending amount"/></div></label><label>Final INR charge <span className="optional">optional</span><div className="amount-input"><span>INR</span><input inputMode="decimal" value={settledInr} onChange={(event) => setSettledInr(event.target.value)} placeholder="Statement amount"/></div></label></div>}
      <label>Description <span className="optional">optional</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === "PURCHASE" ? "Merchant or item" : selectedChoice.label}/></label>
      {type !== "PURCHASE" && type !== "BALANCE_ADJUSTMENT" && <div className="transfer-callout"><ArrowLeftRight size={16}/><span>This is a money movement, not local consumption.</span></div>}
      {formError && <div className="form-error" role="alert">{formError}</div>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={() => setType(null)}>Back</button><button className="button primary" disabled={saving}><Check size={16}/>{saving ? "Saving…" : "Record activity"}</button></div>
    </form>
  </Modal>;
}
