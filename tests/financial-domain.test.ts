import { describe, expect, it } from "vitest";
import { createLedger, FinancialInvariantError, postFinancialEvent, totalConsumption, type FinancialEvent, type PaymentAccount } from "../src/features/money/domain";

const accounts: PaymentAccount[] = [
  { id: "hdfc", name: "HDFC Regalia", accountClass: "EXTERNAL_SOURCE", currency: "INR", openingBalance: "0" },
  { id: "inr-cash", name: "INR Cash", accountClass: "EXTERNAL_SOURCE", currency: "INR", openingBalance: "0" },
  { id: "octopus", name: "Octopus 1", accountClass: "STORED_VALUE", currency: "HKD", openingBalance: "0" },
  { id: "hkd-cash", name: "HKD Cash", accountClass: "STORED_VALUE", currency: "HKD", openingBalance: "0" },
];

let sequence = 0;
const event = (partial: Omit<FinancialEvent, "id" | "idempotencyKey" | "occurredAt" | "description">): FinancialEvent => ({
  id: `tx-${++sequence}`,
  idempotencyKey: `key-${sequence}`,
  occurredAt: "2026-12-28T10:00:00Z",
  description: partial.type,
  ...partial,
});

describe("financial acceptance tests", () => {
  it("1 — funds Octopus without recording local consumption", () => {
    const result = postFinancialEvent(createLedger(accounts), event({ type: "FUND_WALLET", sourceAccountId: "hdfc", destinationAccountId: "octopus", destinationAmount: "500", destinationCurrency: "HKD", settledInrAmount: "5500" }));
    expect(result.ownMoneyOutflowInr).toBe("5500");
    expect(totalConsumption(result, "HKD")).toBe("0");
    expect(result.balances.octopus).toBe("500");
  });

  it("2 — records Octopus MTR consumption without another external outflow", () => {
    let ledger = postFinancialEvent(createLedger(accounts), event({ type: "FUND_WALLET", sourceAccountId: "hdfc", destinationAccountId: "octopus", destinationAmount: "500", destinationCurrency: "HKD", settledInrAmount: "5500" }));
    ledger = postFinancialEvent(ledger, event({ type: "PURCHASE", sourceAccountId: "octopus", sourceAmount: "20", sourceCurrency: "HKD", consumptionAmount: "20", consumptionCurrency: "HKD", category: "Transport" }));
    expect(ledger.ownMoneyOutflowInr).toBe("5500");
    expect(ledger.localConsumption.HKD.Transport).toBe("20");
    expect(ledger.balances.octopus).toBe("480");
  });

  it("3 — records a direct card restaurant as consumption and external outflow once", () => {
    let ledger = postFinancialEvent(createLedger(accounts), event({ type: "FUND_WALLET", sourceAccountId: "hdfc", destinationAccountId: "octopus", destinationAmount: "500", destinationCurrency: "HKD", settledInrAmount: "5500" }));
    ledger = postFinancialEvent(ledger, event({ type: "PURCHASE", sourceAccountId: "hdfc", sourceAmount: "200", sourceCurrency: "HKD", consumptionAmount: "200", consumptionCurrency: "HKD", category: "Food", settledInrAmount: "2210" }));
    expect(ledger.ownMoneyOutflowInr).toBe("7710");
    expect(ledger.localConsumption.HKD.Food).toBe("200");
    expect(ledger.balances.octopus).toBe("500");
  });

  it("4 — exchanges cash without creating consumption", () => {
    const ledger = postFinancialEvent(createLedger(accounts), event({ type: "CASH_EXCHANGE", sourceAccountId: "inr-cash", destinationAccountId: "hkd-cash", sourceAmount: "10000", sourceCurrency: "INR", destinationAmount: "900", destinationCurrency: "HKD", settledInrAmount: "10000" }));
    expect(ledger.ownMoneyOutflowInr).toBe("10000");
    expect(ledger.balances["hkd-cash"]).toBe("900");
    expect(totalConsumption(ledger, "HKD")).toBe("0");
  });

  it("5 — spends cash locally without another external outflow", () => {
    let ledger = postFinancialEvent(createLedger(accounts), event({ type: "CASH_EXCHANGE", sourceAccountId: "inr-cash", destinationAccountId: "hkd-cash", sourceAmount: "10000", sourceCurrency: "INR", destinationAmount: "900", destinationCurrency: "HKD", settledInrAmount: "10000" }));
    ledger = postFinancialEvent(ledger, event({ type: "PURCHASE", sourceAccountId: "hkd-cash", sourceAmount: "100", sourceCurrency: "HKD", consumptionAmount: "100", consumptionCurrency: "HKD", category: "Food" }));
    expect(ledger.ownMoneyOutflowInr).toBe("10000");
    expect(ledger.balances["hkd-cash"]).toBe("800");
    expect(ledger.localConsumption.HKD.Food).toBe("100");
  });

  it("6 — transfers cash to Octopus without affecting spending", () => {
    let ledger = postFinancialEvent(createLedger(accounts), event({ type: "CASH_EXCHANGE", sourceAccountId: "inr-cash", destinationAccountId: "hkd-cash", sourceAmount: "10000", sourceCurrency: "INR", destinationAmount: "900", destinationCurrency: "HKD", settledInrAmount: "10000" }));
    ledger = postFinancialEvent(ledger, event({ type: "PURCHASE", sourceAccountId: "hkd-cash", sourceAmount: "100", sourceCurrency: "HKD", consumptionAmount: "100", consumptionCurrency: "HKD", category: "Food" }));
    ledger = postFinancialEvent(ledger, event({ type: "INTERNAL_TRANSFER", sourceAccountId: "hkd-cash", destinationAccountId: "octopus", sourceAmount: "200", sourceCurrency: "HKD", destinationAmount: "200", destinationCurrency: "HKD" }));
    expect(ledger.balances["hkd-cash"]).toBe("600");
    expect(ledger.balances.octopus).toBe("200");
    expect(ledger.ownMoneyOutflowInr).toBe("10000");
    expect(totalConsumption(ledger, "HKD")).toBe("100");
  });

  it("7 — returns a purchase refund to Octopus and reduces local consumption", () => {
    let ledger = createLedger([{ ...accounts[2], openingBalance: "200" }]);
    ledger = postFinancialEvent(ledger, event({ type: "PURCHASE", sourceAccountId: "octopus", sourceAmount: "200", sourceCurrency: "HKD", consumptionAmount: "200", consumptionCurrency: "HKD", category: "Attractions" }));
    ledger = postFinancialEvent(ledger, event({ type: "PURCHASE_REFUND", destinationAccountId: "octopus", destinationAmount: "50", destinationCurrency: "HKD", consumptionAmount: "50", consumptionCurrency: "HKD", category: "Attractions" }));
    expect(ledger.localConsumption.HKD.Attractions).toBe("150");
    expect(ledger.balances.octopus).toBe("50");
    expect(ledger.ownMoneyOutflowInr).toBe("0");
  });

  it("8 — returns the original transaction for duplicate offline replay", () => {
    const original = event({ type: "FUND_WALLET", sourceAccountId: "hdfc", destinationAccountId: "octopus", destinationAmount: "500", destinationCurrency: "HKD", settledInrAmount: "5500" });
    const once = postFinancialEvent(createLedger(accounts), original);
    const twice = postFinancialEvent(once, { ...original, id: "different-client-id" });
    expect(twice.transactions).toHaveLength(1);
    expect(twice.balances.octopus).toBe("500");
  });

  it("9 — never lets simultaneous wallet spends produce a negative balance", () => {
    let ledger = createLedger([{ ...accounts[2], openingBalance: "100" }]);
    ledger = postFinancialEvent(ledger, event({ type: "PURCHASE", sourceAccountId: "octopus", sourceAmount: "80", sourceCurrency: "HKD", consumptionAmount: "80", consumptionCurrency: "HKD" }));
    expect(() => postFinancialEvent(ledger, event({ type: "PURCHASE", sourceAccountId: "octopus", sourceAmount: "50", sourceCurrency: "HKD", consumptionAmount: "50", consumptionCurrency: "HKD" }))).toThrow(FinancialInvariantError);
    expect(ledger.balances.octopus).toBe("20");
  });

  it("10 — corrects a balance without changing spending", () => {
    let ledger = createLedger([{ ...accounts[2], openingBalance: "100" }]);
    ledger = postFinancialEvent(ledger, event({ type: "BALANCE_ADJUSTMENT", destinationAccountId: "octopus", destinationAmount: "-6", destinationCurrency: "HKD" }));
    expect(ledger.balances.octopus).toBe("94");
    expect(totalConsumption(ledger, "HKD")).toBe("0");
    expect(ledger.ownMoneyOutflowInr).toBe("0");
  });

  it("11 — excludes a voided activity from balances and consumption", () => {
    const ledger = postFinancialEvent(createLedger([{ ...accounts[2], openingBalance: "100" }]), event({ type: "PURCHASE", sourceAccountId: "octopus", sourceAmount: "20", sourceCurrency: "HKD", consumptionAmount: "20", consumptionCurrency: "HKD", voidedAt: "2026-12-29T00:00:00Z" }));
    expect(ledger.balances.octopus).toBe("100");
    expect(totalConsumption(ledger, "HKD")).toBe("0");
  });
});
