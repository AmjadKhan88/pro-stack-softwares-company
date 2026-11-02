/** Picks only known fields from FormData (Next.js adds internal "$ACTION_*" entries we must ignore). */
export function pickFields<const T extends readonly string[]>(
  formData: FormData,
  fields: T,
): Record<T[number], string> {
  const values = {} as Record<T[number], string>;
  for (const field of fields) {
    const raw = formData.get(field);
    if (typeof raw === "string") values[field as T[number]] = raw;
  }
  return values;
}
