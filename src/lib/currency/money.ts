import Decimal from "decimal.js";
import type { CurrencyCode } from "../../types/domain";

const fractionDigits: Record<string, number> = { INR: 2, HKD: 2, MOP: 2, JPY: 0 };

export function formatMoney(value: string | number, currency: CurrencyCode, locale = "en-IN"): string {
  const digits = fractionDigits[currency] ?? 2;
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(new Decimal(value).toNumber());
}

export function convertMoney(value: string, rate: string): string {
  return new Decimal(value).times(rate).toString();
}
