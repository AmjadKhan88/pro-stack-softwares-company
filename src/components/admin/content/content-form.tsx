"use client";

import { useActionState } from "react";
import { MediaField } from "@/components/admin/media/media-field";
import { createContentAction, saveContentAction } from "@/features/cms/actions";
import type { RawForm } from "@/features/cms/schema";
import { slugify } from "@/features/cms/slug";
import { initialContentFormState } from "@/features/cms/state";
import { CONTENT_TYPE_INFO, type ContentType } from "@/features/cms/types";
import type { MediaView } from "@/features/media/types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** An image the editor already chose: its id, and the image itself if it is still available. */
export interface ChosenImage {
  id: string;
  view: MediaView | null;
}

interface Props {
  type: ContentType;
  mode: "create" | "edit";
  /** Required when editing: which item, and the version this form was loaded from. */
  entry?: { id: string; version: number; live: boolean };
  defaults: RawForm;
  /** Live services, for a case study's "related service". */
  serviceOptions?: { slug: string; title: string }[];
  images?: { image?: ChosenImage; ogImage?: ChosenImage };
}

export function ContentForm({ type, mode, entry, defaults, serviceOptions = [], images = {} }: Props) {
  const info = CONTENT_TYPE_INFO[type];
  const [state, formAction, pending] = useActionState(
    mode === "create" ? createContentAction : saveContentAction,
    initialContentFormState,
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const v: RawForm = (state.status !== "idle" && state.values) || defaults;

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-6">
      <input type="hidden" name="contentType" value={type} />
      {entry ? <input type="hidden" name="entryId" value={entry.id} /> : null}
      {entry ? <input type="hidden" name="expectedVersion" value={entry.version} /> : null}

      <FormField id="c-title" label="Title" error={errors.title} required>
        {(c) => (
          <Input
            name="title"
            maxLength={120}
            defaultValue={v.title}
            onBlur={(event) => {
              // A new item gets a suggested URL slug from its title, which can be changed.
              if (mode !== "create") return;
              const slug = document.getElementById("c-slug") as HTMLInputElement | null;
              if (slug && slug.value.trim() === "") slug.value = slugify(event.target.value);
            }}
            {...c}
          />
        )}
      </FormField>

      <FormField
        id="c-slug"
        label="URL slug"
        hint={
          entry?.live
            ? `Live address: ${info.publicPath}/…  Changing it takes effect when you publish, and the old address will redirect.`
            : `Lowercase letters, numbers and hyphens. Public address: ${info.publicPath}/your-slug`
        }
        error={errors.slug}
        required
      >
        {(c) => <Input name="slug" maxLength={80} defaultValue={v.slug} {...c} />}
      </FormField>

      {type === "case_study" ? (
        <FormField
          id="c-category"
          label="Category"
          hint="For example Web application."
          error={errors.category}
        >
          {(c) => <Input name="category" maxLength={60} defaultValue={v.category} {...c} />}
        </FormField>
      ) : null}

      <FormField
        id="c-summary"
        label="Summary"
        hint="One or two sentences shown on listing pages."
        error={errors.summary}
      >
        {(c) => <Textarea name="summary" rows={3} maxLength={300} defaultValue={v.summary} {...c} />}
      </FormField>

      <div className="space-y-1">
        <MediaField
          name="imageAssetId"
          label="Main image"
          hint="Shown at the top of the page. Choose from the media library."
          initialId={images.image?.id ?? v.imageAssetId}
          initial={images.image?.view ?? null}
        />
        {errors.imageAssetId ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {errors.imageAssetId}
          </p>
        ) : null}
      </div>

      {type === "service" ? (
        <>
          <FormField
            id="c-description"
            label="Description"
            hint="What the service is and who it is for."
            error={errors.description}
          >
            {(c) => (
              <Textarea name="description" rows={8} maxLength={4000} defaultValue={v.description} {...c} />
            )}
          </FormField>
          <FormField
            id="c-deliverables"
            label="What you get"
            hint="One item per line."
            error={errors.deliverables}
          >
            {(c) => <Textarea name="deliverables" rows={5} defaultValue={v.deliverables} {...c} />}
          </FormField>
        </>
      ) : (
        <>
          <FormField
            id="c-challenge"
            label="The challenge"
            hint="Leave a blank line between paragraphs."
            error={errors.challenge}
          >
            {(c) => <Textarea name="challenge" rows={7} maxLength={3000} defaultValue={v.challenge} {...c} />}
          </FormField>
          <FormField
            id="c-approach"
            label="Our approach"
            hint="Leave a blank line between paragraphs."
            error={errors.approach}
          >
            {(c) => <Textarea name="approach" rows={7} maxLength={3000} defaultValue={v.approach} {...c} />}
          </FormField>
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField id="c-features" label="Core features" hint="One per line." error={errors.features}>
              {(c) => <Textarea name="features" rows={5} defaultValue={v.features} {...c} />}
            </FormField>
            <FormField id="c-stack" label="Technology" hint="One per line." error={errors.stack}>
              {(c) => <Textarea name="stack" rows={5} defaultValue={v.stack} {...c} />}
            </FormField>
          </div>
          <FormField
            id="c-outcomes"
            label="Verified outcomes"
            hint="Only real results you can back up. Leave empty if you have none."
            error={errors.outcomes}
          >
            {(c) => <Textarea name="outcomes" rows={4} defaultValue={v.outcomes} {...c} />}
          </FormField>
          <label className="flex items-start gap-2 text-sm leading-relaxed">
            <input
              type="checkbox"
              name="outcomesVerified"
              defaultChecked={v.outcomesVerified === "on"}
              className="mt-1"
            />
            <span>I confirm these outcomes are real and I can show evidence if a client asks.</span>
          </label>
          <FormField
            id="c-service"
            label="Related service"
            hint="Only live services are listed."
            error={errors.serviceSlug}
          >
            {(c) => (
              <Select name="serviceSlug" defaultValue={v.serviceSlug ?? ""} {...c}>
                <option value="">None</option>
                {v.serviceSlug && !serviceOptions.some((o) => o.slug === v.serviceSlug) ? (
                  <option value={v.serviceSlug}>{v.serviceSlug} (not live)</option>
                ) : null}
                {serviceOptions.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.title}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </>
      )}

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Search engines and sharing</legend>
        <FormField
          id="c-meta-title"
          label="Page title"
          hint="Optional. Up to 70 characters. Defaults to the title."
          error={errors.metaTitle}
        >
          {(c) => <Input name="metaTitle" maxLength={70} defaultValue={v.metaTitle} {...c} />}
        </FormField>
        <FormField
          id="c-meta-description"
          label="Page description"
          hint="Optional. Up to 170 characters. Defaults to the summary."
          error={errors.metaDescription}
        >
          {(c) => (
            <Textarea
              name="metaDescription"
              rows={2}
              maxLength={170}
              defaultValue={v.metaDescription}
              {...c}
            />
          )}
        </FormField>
        <div className="space-y-1">
          <MediaField
            name="ogImageAssetId"
            label="Social sharing image"
            hint="Shown when the page is shared. Optional: the main image is used if you leave this empty."
            initialId={images.ogImage?.id ?? v.ogImageAssetId}
            initial={images.ogImage?.view ?? null}
          />
          {errors.ogImageAssetId ? (
            <p role="alert" className="text-danger text-sm font-medium">
              {errors.ogImageAssetId}
            </p>
          ) : null}
        </div>
        <label className="flex items-start gap-2 text-sm leading-relaxed">
          <input type="checkbox" name="noindex" defaultChecked={v.noindex === "on"} className="mt-1" />
          <span>Hide this page from search engines (it stays on the website and out of the sitemap).</span>
        </label>
      </fieldset>

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
      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create draft" : "Save draft"}
      </Button>
    </form>
  );
}
