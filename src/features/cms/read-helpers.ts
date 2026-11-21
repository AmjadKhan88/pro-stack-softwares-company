import type { PublicImage } from "@/features/content/types";

/** The few facts the website needs about a library image. Resolved when a page is rendered. */
export interface PublishedAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
}

// Stored content is read defensively: malformed data can't crash a public page.
export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const str = (value: unknown, max = 10_000): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export const list = (value: unknown, max = 50): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim() !== "")
        .map((item) => item.slice(0, 500))
        .slice(0, max)
    : [];

/** The image for an id, or nothing if it is unknown, unavailable or has no description. Never throws. */
export function resolveImage(
  id: unknown,
  assets: Record<string, PublishedAsset> | undefined,
): PublicImage | undefined {
  if (typeof id !== "string" || !assets || !Object.hasOwn(assets, id)) return undefined;
  const asset = assets[id];
  if (!asset.url || !asset.alt) return undefined;
  return { url: asset.url, width: asset.width, height: asset.height, alt: asset.alt };
}
