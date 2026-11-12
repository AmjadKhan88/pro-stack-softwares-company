export const CURRENCIES = ["USD", "PKR", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "US dollar (USD)",
  PKR: "Pakistani rupee (PKR)",
  EUR: "Euro (EUR)",
  GBP: "Pound sterling (GBP)",
};

export const MAX_AMOUNT_MINOR = 100_000_000_000; // 1 billion in major units

/**
 * Turns "1500", "1,500.5" or "1 500.50" into whole minor units (cents/paisa): 150000, 150050.
 * Money is always stored as an integer to avoid floating-point errors. Returns null if invalid.
 */
export function parseMoneyToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
}

/** For pre-filling an edit form: 150050 -> "1500.50". */
export function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2);
}
