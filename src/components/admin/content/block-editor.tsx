"use client";

import { useRef, useState } from "react";
import { MediaField } from "@/components/admin/media/media-field";
import { RichText } from "@/components/public-site/rich-text";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  MAX_BLOCKS,
  emptyEditableBlock,
  type BlockType,
  type EditableBlock,
} from "@/features/cms/block-types";
import type { MediaView } from "@/features/media/types";
import { Button } from "@/components/ui/button";

type Keyed = EditableBlock & { key: string };

const field =
  "border-border bg-surface focus-visible:ring-accent/25 w-full rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none";

function parse(json: string | undefined): EditableBlock[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? (value as EditableBlock[]) : [];
  } catch {
    return [];
  }
}

interface Props {
  /** The blocks as the editor handles them (a JSON list of text values). */
  initialJson: string | undefined;
  /** Library images already used by these blocks, so they can be shown. */
  images: Record<string, MediaView>;
  error?: string;
}

/** Edits a page's blocks: add, change, reorder and remove. Sends them to the server as one hidden field. */
export function BlockEditor({ initialJson, images, error }: Props) {
  const counter = useRef(0);
  const nextKey = () => `b${counter.current++}`;
  const [blocks, setBlocks] = useState<Keyed[]>(() =>
    parse(initialJson).map((block) => ({ ...block, key: nextKey() })),
  );
  const [newType, setNewType] = useState<BlockType>("richtext");

  const update = (key: string, patch: Partial<EditableBlock>) =>
    setBlocks((current) =>
      current.map((block) => (block.key === key ? ({ ...block, ...patch } as Keyed) : block)),
    );
  const remove = (key: string) => setBlocks((current) => current.filter((block) => block.key !== key));
  const move = (index: number, by: -1 | 1) =>
    setBlocks((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const wire = JSON.stringify(blocks.map(({ key: _key, ...rest }) => rest));

  return (
    <div className="space-y-4">
      <input type="hidden" name="blocks" value={wire} />

      <div>
        <p className="text-[13px] font-medium">Content blocks</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Formatting in rich text: <code>## Heading</code>, <code>### Subheading</code>, <code>- bullet</code>
          , <code>1. numbered</code>, <code>&gt; quote</code>, <code>**bold**</code>, <code>*italic*</code>,{" "}
          <code>[link text](https://example.com)</code>. Leave a blank line between paragraphs.
        </p>
      </div>

      {blocks.length === 0 ? (
        <p className="text-muted-foreground text-sm">No blocks yet. Add one below.</p>
      ) : null}

      {blocks.map((block, index) => {
        const n = index + 1;
        const id = (suffix: string) => `${block.key}-${suffix}`;
        return (
          <fieldset key={block.key} className="border-border space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">
              Block {n}: {BLOCK_LABELS[block.type]}
            </legend>

            {block.type === "richtext" ? (
              <div className="space-y-2">
                <label htmlFor={id("text")} className="block text-xs font-medium">
                  Text (block {n})
                </label>
                <textarea
                  id={id("text")}
                  rows={9}
                  maxLength={20000}
                  value={block.text}
                  onChange={(event) => update(block.key, { text: event.target.value })}
                  className={`${field} py-2`}
                />
                <details>
                  <summary className="text-accent cursor-pointer text-xs font-medium">Preview</summary>
                  <div className="border-border mt-2 border-t pt-3 text-sm">
                    <RichText source={block.text} />
                  </div>
                </details>
              </div>
            ) : null}

            {block.type === "image" ? (
              <div className="space-y-3">
                <MediaField
                  label={`Image (block ${n})`}
                  hint="Choose from the media library."
                  initialId={block.assetId}
                  initial={images[block.assetId] ?? null}
                  onChange={(asset) => update(block.key, { assetId: asset?.id ?? "" })}
                />
                <div>
                  <label htmlFor={id("caption")} className="mb-1 block text-xs font-medium">
                    Caption (block {n}, optional)
                  </label>
                  <input
                    id={id("caption")}
                    maxLength={200}
                    value={block.caption}
                    onChange={(event) => update(block.key, { caption: event.target.value })}
                    className={`${field} h-9`}
                  />
                </div>
              </div>
            ) : null}

            {block.type === "steps" || block.type === "technologies" ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor={id("heading")} className="mb-1 block text-xs font-medium">
                    Heading (block {n}, optional)
                  </label>
                  <input
                    id={id("heading")}
                    maxLength={120}
                    value={block.heading}
                    onChange={(event) => update(block.key, { heading: event.target.value })}
                    className={`${field} h-9`}
                  />
                </div>
                <div>
                  <label htmlFor={id("items")} className="mb-1 block text-xs font-medium">
                    {block.type === "steps" ? `Steps (block ${n})` : `Items (block ${n})`}
                  </label>
                  <textarea
                    id={id("items")}
                    rows={5}
                    value={block.items}
                    onChange={(event) => update(block.key, { items: event.target.value })}
                    className={`${field} py-2`}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    {block.type === "steps"
                      ? "One step per line: Title | what happens."
                      : "One item per line."}
                  </p>
                </div>
              </div>
            ) : null}

            {block.type === "cta" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={id("heading")} className="mb-1 block text-xs font-medium">
                    Heading (block {n})
                  </label>
                  <input
                    id={id("heading")}
                    maxLength={120}
                    value={block.heading}
                    onChange={(event) => update(block.key, { heading: event.target.value })}
                    className={`${field} h-9`}
                  />
                </div>
                <div>
                  <label htmlFor={id("label")} className="mb-1 block text-xs font-medium">
                    Button label (block {n})
                  </label>
                  <input
                    id={id("label")}
                    maxLength={40}
                    value={block.buttonLabel}
                    onChange={(event) => update(block.key, { buttonLabel: event.target.value })}
                    className={`${field} h-9`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={id("text")} className="mb-1 block text-xs font-medium">
                    Text (block {n}, optional)
                  </label>
                  <input
                    id={id("text")}
                    maxLength={300}
                    value={block.text}
                    onChange={(event) => update(block.key, { text: event.target.value })}
                    className={`${field} h-9`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={id("href")} className="mb-1 block text-xs font-medium">
                    Button address (block {n})
                  </label>
                  <input
                    id={id("href")}
                    maxLength={300}
                    value={block.buttonHref}
                    onChange={(event) => update(block.key, { buttonHref: event.target.value })}
                    className={`${field} h-9`}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    A page on this site, like /contact, or a full https:// address.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Move block ${n} up`}
              >
                Move up
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move block ${n} down`}
              >
                Move down
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(block.key)}
                aria-label={`Remove block ${n}`}
              >
                Remove
              </Button>
            </div>
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="new-block-type" className="mb-1 block text-xs font-medium">
            Block type
          </label>
          <select
            id="new-block-type"
            value={newType}
            onChange={(event) => setNewType(event.target.value as BlockType)}
            className={`${field} h-9`}
          >
            {BLOCK_TYPES.map((type) => (
              <option key={type} value={type}>
                {BLOCK_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocks.length >= MAX_BLOCKS}
          onClick={() =>
            setBlocks((current) => [...current, { ...emptyEditableBlock(newType), key: nextKey() }])
          }
        >
          Add block
        </Button>
        {blocks.length >= MAX_BLOCKS ? (
          <p className="text-muted-foreground text-xs">That is the most blocks a page can have.</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
