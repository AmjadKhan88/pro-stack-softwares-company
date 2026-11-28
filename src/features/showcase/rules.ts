// Rules for the showcase. Pure (no I/O) so each rule is easy to read and to test.

export const ORDER_STATUSES = ["pending", "approved", "sent", "rejected"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  approved: "Payment received",
  sent: "Source sent",
  rejected: "Rejected",
};

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["sent", "pending", "rejected"],
  sent: [], // finished
  rejected: ["pending"],
};

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export const OFFER_STATUSES = ["draft", "active", "archived"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const MAX_PROOF_BYTES = 3 * 1024 * 1024;

/** Looks at the first bytes of a file, so a renamed file can't pass as an image. */
export function detectImageType(
  bytes: Uint8Array,
): { type: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: "image/jpeg", ext: "jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte))
    return { type: "image/png", ext: "png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(bytes.slice(from, to)));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return { type: "image/webp", ext: "webp" };
  return null;
}

/** 1500000 paisa-style minor units to "Rs 15,000". */
export function formatPkr(minor: number): string {
  return `Rs ${Math.round(minor / 100).toLocaleString("en-US")}`;
}

/** "15,000" or "Rs 15000" in rupees to minor units. Null when it isn't a sensible whole-rupee price. */
export function rupeesToMinor(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "").replace(/^rs\.?/i, "");
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  const rupees = Number(cleaned);
  return rupees >= 1 && rupees <= 10_000_000 ? rupees * 100 : null;
}

export function isValidSlug(value: string): boolean {
  return value.length >= 1 && value.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** "React, Node.js, MongoDB" into a clean list: no blanks, no repeats, at most 12, each up to 30 characters. */
export function parseTechStack(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const item = part.trim();
    if (item.length < 1 || item.length > 30) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length === 12) break;
  }
  return result;
}

export function isSafeHttpsUrl(value: string): boolean {
  if (value.length > 300) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Letters, spaces, dots, hyphens and ’ only. Nothing here can become markup in an email. */
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .’-]{1,99}$/u;
export const PHONE_PATTERN = /^[0-9+()\-\s]{7,25}$/;
export const REFERENCE_NOTE_PATTERN = /^[A-Za-z0-9\-_/. ]{3,60}$/;

/** A WhatsApp link from a phone number, or null. A Pakistani 03xx number is turned into +92. */
export function whatsappLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

/** Removes control characters and tidies line breaks. Always shown as plain text. */
export function cleanText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, "\n")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
