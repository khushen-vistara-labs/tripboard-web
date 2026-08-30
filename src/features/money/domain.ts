import Decimal from "decimal.js";
import type { CurrencyCode } from "../../types/domain";

export type AccountClass = "EXTERNAL_SOURCE" | "STORED_VALUE";
export type FinancialEventType =
  | "PURCHASE"
  | "FUND_WALLET"
  | "INTERNAL_TRANSFER"
  | "CASH_EXCHANGE"
  | "PURCHASE_REFUND"
  | "FUNDING_REFUND"
  | "BALANCE_ADJUSTMENT";

export interface PaymentAccount {
  id: string;
  name: string;
  accountClass: AccountClass;
  currency: CurrencyCode;
  openingBalance: string;
  accountType?: string;
  archivedAt?: string;
  version?: number;
}

export interface FinancialEvent {
  id: string;
  idempotencyKey: string;
  type: FinancialEventType;
  occurredAt: string;
  description: string;
  merchant?: string;
  category?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  sourceAmount?: string;
  sourceCurrency?: CurrencyCode;
  destinationAmount?: string;
  destinationCurrency?: CurrencyCode;
  consumptionAmount?: string;
  consumptionCurrency?: CurrencyCode;
  estimatedInrAmount?: string;
  settledInrAmount?: string;
  settlementStatus?: "PROVISIONAL" | "SETTLED";
  originalTransactionId?: string;
  version?: number;
  voidedAt?: string;
}

export interface LedgerSnapshot {
  accounts: Record<string, PaymentAccount>;
  balances: Record<string, string>;
  transactions: FinancialEvent[];
  localConsumption: Record<string, Record<string, string>>;
  ownMoneyOutflowInr: string;
  hasEstimatedOutflow: boolean;
  processedIdempotencyKeys: string[];
}

export class FinancialInvariantError extends Error {}

const amount = (value?: string) => new Decimal(value ?? 0);

export function createLedger(accounts: PaymentAccount[]): LedgerSnapshot {
  return {
    accounts: Object.fromEntries(accounts.map((account) => [account.id, account])),
    balances: Object.fromEntries(accounts.map((account) => [account.id, account.openingBalance])),
    transactions: [],
    localConsumption: {},
    ownMoneyOutflowInr: "0",
    hasEstimatedOutflow: false,
    processedIdempotencyKeys: [],
  };
}

function getAccount(ledger: LedgerSnapshot, id?: string): PaymentAccount | undefined {
  return id ? ledger.accounts[id] : undefined;
}

function requireStoredValue(ledger: LedgerSnapshot, id: string | undefined, role: string): PaymentAccount {
  const account = getAccount(ledger, id);
  if (!account || account.accountClass !== "STORED_VALUE") {
    throw new FinancialInvariantError(`${role} must be a stored-value account.`);
  }
  return account;
}

function requireExternal(ledger: LedgerSnapshot, id: string | undefined, role: string): PaymentAccount {
  const account = getAccount(ledger, id);
  if (!account || account.accountClass !== "EXTERNAL_SOURCE") {
    throw new FinancialInvariantError(`${role} must be an external funding source.`);
  }
  return account;
}

function assertPositive(value: string | undefined, label: string): Decimal {
  const parsed = amount(value);
  if (!parsed.isPositive()) throw new FinancialInvariantError(`${label} must be greater than zero.`);
  return parsed;
}

function debit(next: LedgerSnapshot, account: PaymentAccount, value: Decimal) {
  const balance = amount(next.balances[account.id]);
  if (balance.lt(value)) throw new FinancialInvariantError(`Not enough balance in ${account.name}.`);
  next.balances[account.id] = balance.minus(value).toString();
}

function credit(next: LedgerSnapshot, account: PaymentAccount, value: Decimal) {
  next.balances[account.id] = amount(next.balances[account.id]).plus(value).toString();
}

function addConsumption(next: LedgerSnapshot, currency: CurrencyCode, category: string, value: Decimal) {
  const currencyTotals = next.localConsumption[currency] ?? {};
  currencyTotals[category] = amount(currencyTotals[category]).plus(value).toString();
  next.localConsumption[currency] = currencyTotals;
}

function addExternalOutflow(next: LedgerSnapshot, event: FinancialEvent, multiplier = new Decimal(1)) {
  const settled = event.settledInrAmount ? amount(event.settledInrAmount) : undefined;
  const estimated = event.estimatedInrAmount ? amount(event.estimatedInrAmount) : undefined;
  const inr = settled ?? estimated;
  if (inr) next.ownMoneyOutflowInr = amount(next.ownMoneyOutflowInr).plus(inr.times(multiplier)).toString();
  if (!settled && estimated) next.hasEstimatedOutflow = true;
}

/** Applies a complete financial command to a cloned snapshot. A rejected command leaves the input untouched. */
export function postFinancialEvent(ledger: LedgerSnapshot, event: FinancialEvent): LedgerSnapshot {
  if (event.voidedAt) return ledger;
  const duplicate = ledger.transactions.find((transaction) => transaction.idempotencyKey === event.idempotencyKey);
  if (duplicate) return ledger;

  const next: LedgerSnapshot = structuredClone(ledger);
  const source = getAccount(next, event.sourceAccountId);
  const destination = getAccount(next, event.destinationAccountId);

  switch (event.type) {
    case "PURCHASE": {
      const purchase = assertPositive(event.consumptionAmount ?? event.sourceAmount, "Purchase amount");
      const currency = event.consumptionCurrency ?? event.sourceCurrency;
      if (!source || !currency) throw new FinancialInvariantError("Purchase requires a payment account and currency.");
      if (source.accountClass === "STORED_VALUE") {
        if (source.currency !== currency) throw new FinancialInvariantError("Wallet purchase currency must match the wallet.");
        debit(next, source, purchase);
      } else {
        addExternalOutflow(next, event);
      }
      addConsumption(next, currency, event.category ?? "Miscellaneous", purchase);
      break;
    }
    case "FUND_WALLET": {
      requireExternal(next, event.sourceAccountId, "Funding source");
      const wallet = requireStoredValue(next, event.destinationAccountId, "Destination");
      const funded = assertPositive(event.destinationAmount, "Funding amount");
      if (wallet.currency !== event.destinationCurrency) throw new FinancialInvariantError("Funding currency must match the wallet.");
      credit(next, wallet, funded);
      addExternalOutflow(next, event);
      break;
    }
    case "CASH_EXCHANGE": {
      requireExternal(next, event.sourceAccountId, "Cash source");
      const cashWallet = requireStoredValue(next, event.destinationAccountId, "Exchange destination");
      assertPositive(event.sourceAmount, "Source amount");
      const received = assertPositive(event.destinationAmount, "Destination amount");
      if (cashWallet.currency !== event.destinationCurrency) throw new FinancialInvariantError("Exchange currency must match the destination wallet.");
      credit(next, cashWallet, received);
      addExternalOutflow(next, event);
      break;
    }
    case "INTERNAL_TRANSFER": {
      const from = requireStoredValue(next, event.sourceAccountId, "Source");
      const to = requireStoredValue(next, event.destinationAccountId, "Destination");
      const sent = assertPositive(event.sourceAmount, "Source amount");
      const received = assertPositive(event.destinationAmount ?? event.sourceAmount, "Destination amount");
      if (from.currency !== event.sourceCurrency || to.currency !== (event.destinationCurrency ?? event.sourceCurrency)) {
        throw new FinancialInvariantError("Transfer currencies must match their accounts.");
      }
      debit(next, from, sent);
      credit(next, to, received);
      break;
    }
    case "PURCHASE_REFUND": {
      const refund = assertPositive(event.consumptionAmount ?? event.destinationAmount, "Refund amount");
      const currency = event.consumptionCurrency ?? event.destinationCurrency;
      if (!currency) throw new FinancialInvariantError("Refund requires a currency.");
      if (destination?.accountClass === "STORED_VALUE") credit(next, destination, refund);
      if (destination?.accountClass === "EXTERNAL_SOURCE") addExternalOutflow(next, event, new Decimal(-1));
      addConsumption(next, currency, event.category ?? "Miscellaneous", refund.negated());
      break;
    }
    case "FUNDING_REFUND": {
      const from = requireStoredValue(next, event.sourceAccountId, "Refund source");
      requireExternal(next, event.destinationAccountId, "Refund destination");
      const refunded = assertPositive(event.sourceAmount, "Refund amount");
      debit(next, from, refunded);
      addExternalOutflow(next, event, new Decimal(-1));
      break;
    }
    case "BALANCE_ADJUSTMENT": {
      const wallet = requireStoredValue(next, event.destinationAccountId ?? event.sourceAccountId, "Adjusted account");
      const adjustment = amount(event.destinationAmount ?? event.sourceAmount);
      const corrected = amount(next.balances[wallet.id]).plus(adjustment);
      if (corrected.isNegative()) throw new FinancialInvariantError(`Not enough balance in ${wallet.name}.`);
      next.balances[wallet.id] = corrected.toString();
      break;
    }
  }

  next.transactions.push(event);
  next.processedIdempotencyKeys.push(event.idempotencyKey);
  return next;
}

export function totalConsumption(ledger: LedgerSnapshot, currency: CurrencyCode): string {
  return Object.values(ledger.localConsumption[currency] ?? {}).reduce((sum, value) => sum.plus(value), new Decimal(0)).toString();
}
