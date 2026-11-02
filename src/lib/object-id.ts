export const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

/** True for a 24-character hex MongoDB id. Always check ids from URLs and forms with this before querying. */
export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}
