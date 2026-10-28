/** Returns a same-site relative path, or null. Blocks open redirects such as //evil.com or https://evil.com. */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  for (const char of value) {
    if (char.charCodeAt(0) < 32) return null;
  }
  try {
    const base = "http://placeholder.invalid";
    if (new URL(value, base).origin !== base) return null;
  } catch {
    return null;
  }
  return value;
}