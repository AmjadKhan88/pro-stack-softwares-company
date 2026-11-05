/** "2026-03-12 14:05 UTC". Dates are stored in UTC and shown the same way everywhere in the admin. */
export function formatDateTimeUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatDateUtc(date: Date): string {
  return `${date.toISOString().slice(0, 10)} UTC`;
}
