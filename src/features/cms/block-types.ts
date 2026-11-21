export const MAX_BLOCKS = 40;

export const BLOCK_TYPES = ["richtext", "image", "steps", "technologies", "cta"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  richtext: "Rich text",
  image: "Image",
  steps: "Process steps",
  technologies: "Technology list",
  cta: "Call to action",
};

export interface StepItem {
  title: string;
  description: string;
}

/** A block as it is stored and shown on the website. */
export type Block =
  | { type: "richtext"; text: string }
  | { type: "image"; assetId: string; caption?: string }
  | { type: "steps"; heading?: string; items: StepItem[] }
  | { type: "technologies"; heading?: string; items: string[] }
  | { type: "cta"; heading: string; text?: string; buttonLabel: string; buttonHref: string };

/** A block as the editor handles it: every value is text. */
export type EditableBlock =
  | { type: "richtext"; text: string }
  | { type: "image"; assetId: string; caption: string }
  | { type: "steps"; heading: string; items: string }
  | { type: "technologies"; heading: string; items: string }
  | { type: "cta"; heading: string; text: string; buttonLabel: string; buttonHref: string };

export function emptyEditableBlock(type: BlockType): EditableBlock {
  switch (type) {
    case "richtext":
      return { type, text: "" };
    case "image":
      return { type, assetId: "", caption: "" };
    case "steps":
      return { type, heading: "", items: "" };
    case "technologies":
      return { type, heading: "", items: "" };
    case "cta":
      return { type, heading: "", text: "", buttonLabel: "", buttonHref: "" };
  }
}

/** One step per line: "Title | what happens". */
export function stepsToText(items: StepItem[]): string {
  return items
    .map((item) => (item.description ? `${item.title} | ${item.description}` : item.title))
    .join("\n");
}
