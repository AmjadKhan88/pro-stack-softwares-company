const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|otp|backup|code/i;
const MAX_STRING = 500;
const MAX_DEPTH = 4;

/** Audit metadata must never carry secrets. Sensitive-looking keys are masked and long strings are cut. */
export function redactMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactMetadata(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : redactMetadata(item, depth + 1),
    ]),
  );
}
