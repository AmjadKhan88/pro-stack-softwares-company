import { z } from "zod";
import type { PublicBlock } from "@/features/content/types";
import { isObjectId } from "@/lib/object-id";
import { splitLines } from "@/features/proposals/schema";
import { MAX_BLOCKS, stepsToText, type Block, type EditableBlock, type StepItem } from "./block-types";
import { asRecord, list, resolveImage, str, type PublishedAsset } from "./read-helpers";
import { safeHref } from "./richtext";

const MAX_JSON = 300_000;

const href = z
  .string()
  .trim()
  .max(300, "Keep the address under 300 characters.")
  .refine(
    (value) => value === "" || safeHref(value) !== null,
    "Use a page on this site (like /contact) or a full https:// address.",
  );
const assetId = z
  .string()
  .trim()
  .refine((value) => value === "" || isObjectId(value), "Choose an image from the library.");

// What the editor sends: every value is text. Checked strictly, then turned into real blocks below.
const wireBlock = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("richtext"),
    text: z.string().max(20_000, "Keep the text under 20,000 characters."),
  }),
  z.strictObject({
    type: z.literal("image"),
    assetId,
    caption: z.string().trim().max(200, "Keep the caption under 200 characters."),
  }),
  z.strictObject({
    type: z.literal("steps"),
    heading: z.string().trim().max(120, "Keep the heading under 120 characters."),
    items: z.string().max(6_000, "That is too much text for the steps."),
  }),
  z.strictObject({
    type: z.literal("technologies"),
    heading: z.string().trim().max(120, "Keep the heading under 120 characters."),
    items: z.string().max(3_000, "That is too much text for the list."),
  }),
  z.strictObject({
    type: z.literal("cta"),
    heading: z.string().trim().max(120, "Keep the heading under 120 characters."),
    text: z.string().trim().max(300, "Keep the text under 300 characters."),
    buttonLabel: z.string().trim().max(40, "Keep the button label under 40 characters."),
    buttonHref: href,
  }),
]);

type Wire = z.infer<typeof wireBlock>;
type Converted = { ok: true; block: Block } | { ok: false; message: string };
const bad = (message: string): Converted => ({ ok: false, message });

function convert(wire: Wire): Converted {
  switch (wire.type) {
    case "richtext":
      return { ok: true, block: { type: "richtext", text: wire.text.trim() } };
    case "image":
      return {
        ok: true,
        block: { type: "image", assetId: wire.assetId, ...(wire.caption ? { caption: wire.caption } : {}) },
      };
    case "steps": {
      const items: StepItem[] = [];
      for (const line of splitLines(wire.items)) {
        const [rawTitle, ...rest] = line.split("|");
        const title = rawTitle.trim();
        const description = rest.join("|").trim();
        if (!title) return bad("Each step needs a title before the | sign.");
        if (title.length > 80) return bad("Keep each step title under 80 characters.");
        if (description.length > 400) return bad("Keep each step description under 400 characters.");
        items.push({ title, description });
      }
      if (items.length > 12) return bad("Use at most 12 steps.");
      return {
        ok: true,
        block: { type: "steps", ...(wire.heading ? { heading: wire.heading } : {}), items },
      };
    }
    case "technologies": {
      const items = splitLines(wire.items);
      if (items.length > 30) return bad("Use at most 30 items.");
      if (items.some((item) => item.length > 40)) return bad("Keep each item under 40 characters.");
      return {
        ok: true,
        block: { type: "technologies", ...(wire.heading ? { heading: wire.heading } : {}), items },
      };
    }
    case "cta":
      return {
        ok: true,
        block: {
          type: "cta",
          heading: wire.heading,
          ...(wire.text ? { text: wire.text } : {}),
          buttonLabel: wire.buttonLabel,
          buttonHref: wire.buttonHref,
        },
      };
  }
}

export type BlocksResult = { ok: true; blocks: Block[] } | { ok: false; message: string };

/** Checks the editor's blocks. Messages say which block is wrong ("Block 3: ..."). Drafts may be incomplete. */
export function parseBlocksJson(raw: string | undefined): BlocksResult {
  if (!raw || raw.trim() === "") return { ok: true, blocks: [] };
  const unreadable: BlocksResult = {
    ok: false,
    message: "The content couldn't be read. Reload the page and try again.",
  };
  if (raw.length > MAX_JSON)
    return { ok: false, message: "This page has too much content. Remove some blocks." };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return unreadable;
  }
  if (!Array.isArray(json)) return unreadable;
  if (json.length > MAX_BLOCKS) return { ok: false, message: `Use at most ${MAX_BLOCKS} blocks.` };

  const blocks: Block[] = [];
  for (const [index, item] of json.entries()) {
    const parsed = wireBlock.safeParse(item);
    if (!parsed.success) {
      return {
        ok: false,
        message: `Block ${index + 1}: ${parsed.error.issues[0]?.message ?? "Please check this block."}`,
      };
    }
    const converted = convert(parsed.data);
    if (!converted.ok) return { ok: false, message: `Block ${index + 1}: ${converted.message}` };
    blocks.push(converted.block);
  }
  return { ok: true, blocks };
}

/** Stored blocks back into what the editor needs. Unknown or damaged blocks are dropped. */
export function toEditableBlocks(raw: unknown): EditableBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: EditableBlock[] = [];
  for (const item of raw.slice(0, MAX_BLOCKS)) {
    const b = asRecord(item);
    switch (b.type) {
      case "richtext":
        out.push({ type: "richtext", text: str(b.text, 20_000) });
        break;
      case "image":
        out.push({ type: "image", assetId: str(b.assetId, 40), caption: str(b.caption, 200) });
        break;
      case "steps": {
        const items: StepItem[] = (Array.isArray(b.items) ? b.items : []).slice(0, 12).map((entry) => {
          const e = asRecord(entry);
          return { title: str(e.title, 80), description: str(e.description, 400) };
        });
        out.push({ type: "steps", heading: str(b.heading, 120), items: stepsToText(items) });
        break;
      }
      case "technologies":
        out.push({ type: "technologies", heading: str(b.heading, 120), items: list(b.items, 30).join("\n") });
        break;
      case "cta":
        out.push({
          type: "cta",
          heading: str(b.heading, 120),
          text: str(b.text, 300),
          buttonLabel: str(b.buttonLabel, 40),
          buttonHref: str(b.buttonHref, 300),
        });
        break;
    }
  }
  return out;
}

export const editableBlocksJson = (raw: unknown): string => JSON.stringify(toEditableBlocks(raw));

/** The library images a set of blocks uses. Safe to call on anything. */
export function blockAssetIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const item of raw.slice(0, MAX_BLOCKS)) {
    const b = asRecord(item);
    if (b.type === "image" && typeof b.assetId === "string" && isObjectId(b.assetId)) ids.push(b.assetId);
  }
  return ids;
}

/** Everything that must be true of the blocks before publishing. Plain-language problems, empty = ready. */
export function validateBlocksForPublish(blocks: Block[]): string[] {
  if (blocks.length === 0) return ["Add at least one block."];
  const problems: string[] = [];
  blocks.forEach((block, index) => {
    const at = `Block ${index + 1}`;
    switch (block.type) {
      case "richtext":
        if (!block.text.trim()) problems.push(`${at}: write some text, or remove the block.`);
        break;
      case "image":
        if (!block.assetId) problems.push(`${at}: choose an image, or remove the block.`);
        break;
      case "steps":
        if (block.items.length === 0) problems.push(`${at}: add at least one step, or remove the block.`);
        break;
      case "technologies":
        if (block.items.length === 0) problems.push(`${at}: add at least one item, or remove the block.`);
        break;
      case "cta":
        if (!block.heading) problems.push(`${at}: add a heading.`);
        if (!block.buttonLabel) problems.push(`${at}: add a button label.`);
        if (!block.buttonHref || safeHref(block.buttonHref) === null) {
          problems.push(`${at}: add a valid button address.`);
        }
        break;
    }
  });
  return problems;
}

/** Every piece of text in the blocks, for the placeholder check. */
export function blockTexts(blocks: Block[]): string[] {
  const texts: string[] = [];
  for (const block of blocks) {
    if (block.type === "richtext") texts.push(block.text);
    if (block.type === "image" && block.caption) texts.push(block.caption);
    if (block.type === "steps") {
      if (block.heading) texts.push(block.heading);
      for (const item of block.items) texts.push(item.title, item.description);
    }
    if (block.type === "technologies") {
      if (block.heading) texts.push(block.heading);
      texts.push(...block.items);
    }
    if (block.type === "cta") texts.push(block.heading, block.text ?? "", block.buttonLabel);
  }
  return texts;
}

const PLACEHOLDER = /\[\[[^\]]{1,200}\]\]/;

/** Template text marks what still needs to be filled in as [[like this]]. Such text must not go live. */
export function findPlaceholder(texts: string[]): string | null {
  for (const text of texts) {
    const match = PLACEHOLDER.exec(text);
    if (match) return match[0].slice(0, 60);
  }
  return null;
}

/**
 * Stored blocks into what the website draws. Anything damaged, unknown, unsafe or pointing at an unavailable
 * image is skipped: a bad block never breaks a page. Never throws.
 */
export function toPublicBlocks(raw: unknown, assets?: Record<string, PublishedAsset>): PublicBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicBlock[] = [];
  for (const item of raw.slice(0, 60)) {
    const b = asRecord(item);
    switch (b.type) {
      case "richtext": {
        const text = str(b.text, 20_000).trim();
        if (text) out.push({ type: "richtext", text });
        break;
      }
      case "image": {
        const image = resolveImage(b.assetId, assets);
        if (!image) break;
        const caption = str(b.caption, 200).trim();
        out.push({ type: "image", image, ...(caption ? { caption } : {}) });
        break;
      }
      case "steps": {
        const items = (Array.isArray(b.items) ? b.items : [])
          .slice(0, 12)
          .map((entry) => {
            const e = asRecord(entry);
            return { title: str(e.title, 80).trim(), description: str(e.description, 400).trim() };
          })
          .filter((entry) => entry.title);
        const heading = str(b.heading, 120).trim();
        if (items.length > 0) out.push({ type: "steps", ...(heading ? { heading } : {}), items });
        break;
      }
      case "technologies": {
        const items = list(b.items, 30);
        const heading = str(b.heading, 120).trim();
        if (items.length > 0) out.push({ type: "technologies", ...(heading ? { heading } : {}), items });
        break;
      }
      case "cta": {
        const heading = str(b.heading, 120).trim();
        const buttonLabel = str(b.buttonLabel, 40).trim();
        const buttonHref = safeHref(str(b.buttonHref, 300));
        const text = str(b.text, 300).trim();
        if (heading && buttonLabel && buttonHref) {
          out.push({ type: "cta", heading, ...(text ? { text } : {}), buttonLabel, buttonHref });
        }
        break;
      }
    }
  }
  return out;
}
