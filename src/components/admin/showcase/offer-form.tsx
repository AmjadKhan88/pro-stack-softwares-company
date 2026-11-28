"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveOfferAction } from "@/features/showcase/offer-actions";
import { OFFER_STATUSES } from "@/features/showcase/rules";
import { initialActionState, type OfferRow } from "@/features/showcase/types";

const INPUT =
  "border-border bg-surface focus-visible:ring-accent/25 w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-4 focus-visible:outline-none";

const STATUS_TEXT: Record<(typeof OFFER_STATUSES)[number], string> = {
  draft: "Draft (hidden)",
  active: "Active (visible and can be ordered)",
  archived: "Archived (hidden)",
};

export function OfferForm({ offer }: { offer?: OfferRow }) {
  const [state, formAction, pending] = useActionState(saveOfferAction, initialActionState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const field = (id: string, label: string, control: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      {control}
      {hint && !errors[id] ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {errors[id] ? (
        <p id={`${id}-error`} role="alert" className="text-danger text-xs font-medium">
          {errors[id]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      {offer ? <input type="hidden" name="id" value={offer.id} /> : null}
      {field(
        "title",
        "Project name",
        <input id="title" name="title" defaultValue={offer?.title} className={INPUT} />,
      )}
      {field(
        "slug",
        "Web address",
        <input
          id="slug"
          name="slug"
          defaultValue={offer?.slug}
          readOnly={Boolean(offer)}
          className={INPUT}
        />,
        offer
          ? "The address can't be changed after the project is created."
          : "Optional. Made from the name when left empty, for example e-commerce-store.",
      )}
      {field(
        "summary",
        "Short summary",
        <textarea id="summary" name="summary" rows={2} defaultValue={offer?.summary} className={INPUT} />,
        "Shown on the project card. Up to 300 characters.",
      )}
      {field(
        "description",
        "Description (optional)",
        <textarea
          id="description"
          name="description"
          rows={7}
          defaultValue={offer?.description}
          className={INPUT}
        />,
        "What the buyer gets. Separate paragraphs with a blank line. Plain text only.",
      )}
      {field(
        "techStack",
        "Technologies (optional)",
        <input
          id="techStack"
          name="techStack"
          defaultValue={offer?.techStack.join(", ")}
          className={INPUT}
        />,
        "Separated by commas, for example Next.js, MongoDB, Tailwind.",
      )}
      {field(
        "liveUrl",
        "Live demo link (optional)",
        <input id="liveUrl" name="liveUrl" defaultValue={offer?.liveUrl ?? ""} className={INPUT} />,
        "A full link starting with https://",
      )}
      {field(
        "caseStudySlug",
        "Case study address (optional)",
        <input
          id="caseStudySlug"
          name="caseStudySlug"
          defaultValue={offer?.caseStudySlug ?? ""}
          className={INPUT}
        />,
        "The address of a published case study under /work, to link to it.",
      )}
      <div className="grid gap-5 sm:grid-cols-3">
        {field(
          "price",
          "Price in rupees",
          <input
            id="price"
            name="price"
            inputMode="numeric"
            defaultValue={offer ? String(offer.priceMinor / 100) : ""}
            className={INPUT}
          />,
          "For example 15000",
        )}
        {field(
          "status",
          "Status",
          <select id="status" name="status" defaultValue={offer?.status ?? "draft"} className={INPUT}>
            {OFFER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_TEXT[status]}
              </option>
            ))}
          </select>,
        )}
        {field(
          "sortOrder",
          "Order",
          <input
            id="sortOrder"
            name="sortOrder"
            inputMode="numeric"
            defaultValue={offer ? String(offer.sortOrder) : "0"}
            className={INPUT}
          />,
          "Smaller numbers come first.",
        )}
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-success text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving…" : offer ? "Save changes" : "Save project"}
      </Button>
    </form>
  );
}
