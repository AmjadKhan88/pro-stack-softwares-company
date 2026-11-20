"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { searchPickerAction } from "@/features/media/actions";
import type { MediaView } from "@/features/media/types";
import { Button } from "@/components/ui/button";

interface Props {
  /** The form field that receives the chosen image's id ("" for none). */
  name: string;
  label: string;
  hint?: string;
  /** Set when something is already chosen. `initial` is null if that image is no longer available. */
  initialId?: string;
  initial?: MediaView | null;
}

export function MediaField({ name, label, hint, initialId, initial }: Props) {
  const [selected, setSelected] = useState<MediaView | null>(initial ?? null);
  const [selectedId, setSelectedId] = useState(initial?.id ?? initialId ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<MediaView[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(nextQuery: string, nextPage: number) {
    startTransition(async () => {
      const result = await searchPickerAction({ q: nextQuery, page: nextPage });
      if (!result.ok) return setError(result.message);
      setError(null);
      setAssets(result.assets);
      setPage(result.page);
      setPageCount(result.pageCount);
    });
  }

  function choose(asset: MediaView) {
    setSelected(asset);
    setSelectedId(asset.id);
    setOpen(false);
  }

  const unavailable = selectedId !== "" && selected === null;

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium">{label}</p>
      <input type="hidden" name={name} value={selectedId} />

      {selected ? (
        <div className="border-border bg-surface flex items-center gap-3 rounded-lg border p-2">
          <Image
            src={selected.url}
            alt={selected.alt}
            width={64}
            height={48}
            className="h-12 w-16 rounded object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-sm">{selected.alt}</p>
        </div>
      ) : unavailable ? (
        <p role="alert" className="text-danger text-sm font-medium">
          The chosen image is no longer available. Choose another, or remove it.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">No image chosen.</p>
      )}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) load(query, 1);
          }}
        >
          {selected || unavailable ? "Change image" : "Choose image"}
        </Button>
        {selectedId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(null);
              setSelectedId("");
            }}
          >
            Remove image
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="border-border space-y-3 rounded-lg border p-3">
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              placeholder="Search by file name or description"
              aria-label="Search images"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  load(query, 1);
                }
              }}
              className="border-border bg-surface focus-visible:ring-accent/25 h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => load(query, 1)}
              disabled={pending}
            >
              Search
            </Button>
          </div>

          {error ? (
            <p role="alert" className="text-danger text-sm font-medium">
              {error}
            </p>
          ) : null}
          {!error && assets.length === 0 && !pending ? (
            <p className="text-muted-foreground text-sm">
              No images found. Upload some in the media library first.
            </p>
          ) : null}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy={pending}>
            {assets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => choose(asset)}
                  className="border-border hover:border-muted-foreground focus-visible:ring-accent/25 w-full overflow-hidden rounded-lg border text-left focus-visible:ring-4 focus-visible:outline-none"
                >
                  <span className="bg-surface-muted relative block aspect-[4/3]">
                    <Image src={asset.url} alt="" fill sizes="160px" className="object-cover" />
                  </span>
                  <span className="block truncate px-2 py-1.5 text-xs">{asset.alt}</span>
                </button>
              </li>
            ))}
          </ul>

          {pageCount > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1 || pending}
                onClick={() => load(query, page - 1)}
              >
                ← Previous
              </Button>
              <span className="text-muted-foreground tabular-nums">
                Page {page} of {pageCount}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= pageCount || pending}
                onClick={() => load(query, page + 1)}
              >
                Next →
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
