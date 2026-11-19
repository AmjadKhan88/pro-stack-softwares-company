import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { paginate, type Paged } from "@/lib/list-links";
import { isObjectId } from "@/lib/object-id";
import { escapeRegex } from "@/lib/search";
import { connectToDatabase } from "@/server/db/mongoose";
import type { ContentFilters } from "./list-params";
import { ContentEntry } from "./models/content-entry";
import { ContentRevision } from "./models/content-revision";
import { SlugRedirect } from "./models/slug-redirect";
import { validateForPublish, type ParsedContent } from "./schema";
import {
  canMoveContent,
  type ContentData,
  type ContentEvent,
  type ContentStatus,
  type ContentType,
  type SeoData,
} from "./types";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function withSession<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let value!: T;
    await session.withTransaction(async () => {
      value = await work(session);
    });
    return value;
  } finally {
    await session.endSession();
  }
}

const titleOf = (data: unknown): string =>
  typeof data === "object" && data !== null && typeof (data as { title?: unknown }).title === "string"
    ? (data as { title: string }).title
    : "";

async function addRevision(
  session: ClientSession,
  entry: { id: string; version: number; slug: string; data: Record<string, unknown>; seo: SeoData },
  event: ContentEvent,
  actor: AuditActor,
) {
  await ContentRevision.create(
    [
      {
        entryId: entry.id,
        version: entry.version,
        event,
        slug: entry.slug,
        title: titleOf(entry.data),
        data: entry.data,
        seo: entry.seo,
        actorId: actor.id,
        actorEmail: actor.email,
      },
    ],
    { session },
  );
}

// ---------------------------------------------------------------- writes

export type CreateResult = { ok: true; id: string } | { ok: false; reason: "slug-taken" };

export async function createEntry(input: {
  type: ContentType;
  parsed: ParsedContent;
  actor: AuditActor;
}): Promise<CreateResult> {
  await connectToDatabase();
  const { slug, data, seo } = input.parsed;
  const draft = data as unknown as Record<string, unknown>;
  try {
    return await withSession<CreateResult>(async (session) => {
      const [created] = await ContentEntry.create(
        [
          {
            type: input.type,
            slug,
            status: "draft" as const,
            draft,
            draftSeo: seo,
            draftVersion: 1,
            createdBy: input.actor.id,
            createdByEmail: input.actor.email,
          },
        ],
        { session },
      );
      const id = String(created._id);
      await addRevision(session, { id, version: 1, slug, data: draft, seo }, "created", input.actor);
      await recordAudit(
        {
          actor: input.actor,
          action: "content.created",
          target: { type: "content", id },
          metadata: { contentType: input.type, slug },
        },
        session,
      );
      return { ok: true, id };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { ok: false, reason: "slug-taken" };
    throw error;
  }
}

export type SaveResult =
  { ok: true } | { ok: false; reason: "not-found" | "archived" | "conflict" | "slug-taken" };

/** Saves the draft only. It never touches what the public site shows. */
export async function saveDraft(input: {
  id: string;
  type: ContentType;
  expectedVersion: number;
  parsed: ParsedContent;
  actor: AuditActor;
}): Promise<SaveResult> {
  await connectToDatabase();
  const { slug, data, seo } = input.parsed;
  const draft = data as unknown as Record<string, unknown>;
  try {
    return await withSession<SaveResult>(async (session) => {
      const entry = await ContentEntry.findOne({ _id: input.id, type: input.type }).session(session).lean();
      if (!entry) return { ok: false, reason: "not-found" };
      if (entry.status === "archived") return { ok: false, reason: "archived" };
      if (entry.draftVersion !== input.expectedVersion) return { ok: false, reason: "conflict" };

      const next = entry.draftVersion + 1;
      const updated = await ContentEntry.updateOne(
        { _id: input.id, draftVersion: input.expectedVersion, status: { $ne: "archived" } },
        { $set: { slug, draft, draftSeo: seo, draftVersion: next } },
        { session },
      );
      if (updated.modifiedCount !== 1) return { ok: false, reason: "conflict" };
      await addRevision(
        session,
        { id: input.id, version: next, slug, data: draft, seo },
        "saved",
        input.actor,
      );
      return { ok: true };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { ok: false, reason: "slug-taken" };
    throw error;
  }
}

export type PublishResult =
  | { ok: true; type: ContentType; slug: string }
  | { ok: false; reason: "not-found" | "archived" | "conflict" | "slug-in-use" }
  | { ok: false; reason: "incomplete"; problems: string[] };

/**
 * Makes the draft public. It publishes exactly the version the editor looked at (expectedVersion), checks the
 * content is complete, keeps the old address working with a redirect, and writes the audit record, all in one
 * transaction.
 */
export async function publishEntry(input: {
  id: string;
  expectedVersion: number;
  actor: AuditActor;
}): Promise<PublishResult> {
  await connectToDatabase();
  try {
    return await withSession<PublishResult>(async (session) => {
      const entry = await ContentEntry.findById(input.id).session(session).lean();
      if (!entry) return { ok: false, reason: "not-found" };
      if (!canMoveContent(entry.status, "published")) return { ok: false, reason: "archived" };
      if (entry.draftVersion !== input.expectedVersion) return { ok: false, reason: "conflict" };

      const problems = validateForPublish(entry.type, entry.draft as unknown as ContentData);
      if (problems.length > 0) return { ok: false, reason: "incomplete", problems };

      const now = new Date();
      const previousSlug = entry.publishedSlug;
      const updated = await ContentEntry.updateOne(
        { _id: input.id, draftVersion: input.expectedVersion, status: { $ne: "archived" } },
        {
          $set: {
            status: "published",
            published: entry.draft,
            publishedSeo: entry.draftSeo,
            publishedSlug: entry.slug,
            publishedVersion: entry.draftVersion,
            publishedAt: entry.publishedAt ?? now,
          },
        },
        { session },
      );
      if (updated.modifiedCount !== 1) return { ok: false, reason: "conflict" };

      if (previousSlug && previousSlug !== entry.slug) {
        await SlugRedirect.updateOne(
          { type: entry.type, fromSlug: previousSlug },
          { $set: { entryId: input.id } },
          { upsert: true, session },
        );
      }
      // The live address must never be shadowed by an old redirect.
      await SlugRedirect.deleteMany({ type: entry.type, fromSlug: entry.slug }, { session });

      await addRevision(
        session,
        {
          id: input.id,
          version: entry.draftVersion,
          slug: entry.slug,
          data: entry.draft,
          seo: entry.draftSeo,
        },
        "published",
        input.actor,
      );
      await recordAudit(
        {
          actor: input.actor,
          action: "content.published",
          target: { type: "content", id: input.id },
          metadata: {
            contentType: entry.type,
            slug: entry.slug,
            version: entry.draftVersion,
            previousSlug: previousSlug && previousSlug !== entry.slug ? previousSlug : undefined,
          },
        },
        session,
      );
      return { ok: true, type: entry.type, slug: entry.slug };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { ok: false, reason: "slug-in-use" };
    throw error;
  }
}

export type LifecycleResult =
  { ok: true; type: ContentType } | { ok: false; reason: "not-found" | "invalid-state" | "slug-taken" };

/** Takes a published item off the website. The draft stays, ready to edit or publish again. */
export async function unpublishEntry(input: { id: string; actor: AuditActor }): Promise<LifecycleResult> {
  await connectToDatabase();
  return withSession<LifecycleResult>(async (session) => {
    const entry = await ContentEntry.findById(input.id).session(session).lean();
    if (!entry) return { ok: false, reason: "not-found" };
    if (entry.status !== "published") return { ok: false, reason: "invalid-state" };

    const updated = await ContentEntry.updateOne(
      { _id: input.id, status: "published" },
      {
        $set: { status: "draft" },
        $unset: { published: 1, publishedSeo: 1, publishedSlug: 1, publishedVersion: 1 },
      },
      { session },
    );
    if (updated.modifiedCount !== 1) return { ok: false, reason: "invalid-state" };
    await addRevision(
      session,
      { id: input.id, version: entry.draftVersion, slug: entry.slug, data: entry.draft, seo: entry.draftSeo },
      "unpublished",
      input.actor,
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "content.unpublished",
        target: { type: "content", id: input.id },
        metadata: { contentType: entry.type, slug: entry.publishedSlug ?? entry.slug },
      },
      session,
    );
    return { ok: true, type: entry.type };
  });
}

/** Archiving hides an item from the editor's list. Only drafts can be archived, so nothing live disappears silently. */
export async function archiveEntry(input: { id: string; actor: AuditActor }): Promise<LifecycleResult> {
  await connectToDatabase();
  return withSession<LifecycleResult>(async (session) => {
    const entry = await ContentEntry.findById(input.id).session(session).lean();
    if (!entry) return { ok: false, reason: "not-found" };
    if (entry.status !== "draft" || !canMoveContent(entry.status, "archived"))
      return { ok: false, reason: "invalid-state" };

    const updated = await ContentEntry.updateOne(
      { _id: input.id, status: "draft" },
      { $set: { status: "archived" } },
      { session },
    );
    if (updated.modifiedCount !== 1) return { ok: false, reason: "invalid-state" };
    await addRevision(
      session,
      { id: input.id, version: entry.draftVersion, slug: entry.slug, data: entry.draft, seo: entry.draftSeo },
      "archived",
      input.actor,
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "content.archived",
        target: { type: "content", id: input.id },
        metadata: { contentType: entry.type, slug: entry.slug },
      },
      session,
    );
    return { ok: true, type: entry.type };
  });
}

export async function unarchiveEntry(input: { id: string; actor: AuditActor }): Promise<LifecycleResult> {
  await connectToDatabase();
  return withSession<LifecycleResult>(async (session) => {
    const entry = await ContentEntry.findById(input.id).session(session).lean();
    if (!entry) return { ok: false, reason: "not-found" };
    if (entry.status !== "archived") return { ok: false, reason: "invalid-state" };

    const updated = await ContentEntry.updateOne(
      { _id: input.id, status: "archived" },
      { $set: { status: "draft" } },
      { session },
    );
    if (updated.modifiedCount !== 1) return { ok: false, reason: "invalid-state" };
    await addRevision(
      session,
      { id: input.id, version: entry.draftVersion, slug: entry.slug, data: entry.draft, seo: entry.draftSeo },
      "unarchived",
      input.actor,
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "content.unarchived",
        target: { type: "content", id: input.id },
        metadata: { contentType: entry.type, slug: entry.slug },
      },
      session,
    );
    return { ok: true, type: entry.type };
  });
}

export type RestoreResult =
  { ok: true } | { ok: false; reason: "not-found" | "archived" | "conflict" | "slug-taken" };

/** Loads an earlier version INTO THE DRAFT as a new version. It never publishes anything. */
export async function restoreRevision(input: {
  id: string;
  revisionId: string;
  expectedVersion: number;
  actor: AuditActor;
}): Promise<RestoreResult> {
  await connectToDatabase();
  try {
    return await withSession<RestoreResult>(async (session) => {
      const entry = await ContentEntry.findById(input.id).session(session).lean();
      const revision = await ContentRevision.findOne({ _id: input.revisionId, entryId: input.id })
        .session(session)
        .lean();
      if (!entry || !revision) return { ok: false, reason: "not-found" };
      if (entry.status === "archived") return { ok: false, reason: "archived" };
      if (entry.draftVersion !== input.expectedVersion) return { ok: false, reason: "conflict" };

      const next = entry.draftVersion + 1;
      const updated = await ContentEntry.updateOne(
        { _id: input.id, draftVersion: input.expectedVersion, status: { $ne: "archived" } },
        { $set: { slug: revision.slug, draft: revision.data, draftSeo: revision.seo, draftVersion: next } },
        { session },
      );
      if (updated.modifiedCount !== 1) return { ok: false, reason: "conflict" };
      await addRevision(
        session,
        { id: input.id, version: next, slug: revision.slug, data: revision.data, seo: revision.seo },
        "restored",
        input.actor,
      );
      await recordAudit(
        {
          actor: input.actor,
          action: "content.revision_restored",
          target: { type: "content", id: input.id },
          metadata: { contentType: entry.type, restoredVersion: revision.version },
        },
        session,
      );
      return { ok: true };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { ok: false, reason: "slug-taken" };
    throw error;
  }
}

// ---------------------------------------------------------------- reads

export interface EntryRow {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  hasUnpublishedChanges: boolean;
  publishedSlug: string | null;
  updatedAt: Date;
}

export async function listEntries(type: ContentType, filters: ContentFilters): Promise<Paged<EntryRow>> {
  await connectToDatabase();
  const query: Record<string, unknown> = { type, status: filters.status ?? { $ne: "archived" } };
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ "draft.title": pattern }, { slug: pattern }];
  }
  const total = await ContentEntry.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, filters.page);
  const docs = await ContentEntry.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean();
  return {
    rows: docs.map((doc) => ({
      id: String(doc._id),
      slug: doc.slug,
      title: titleOf(doc.draft) || doc.slug,
      status: doc.status,
      hasUnpublishedChanges: doc.status === "published" && (doc.publishedVersion ?? 0) !== doc.draftVersion,
      publishedSlug: doc.publishedSlug ?? null,
      updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
    })),
    total,
    page,
    pageCount,
  };
}

export interface EntryDetail {
  id: string;
  type: ContentType;
  slug: string;
  status: ContentStatus;
  data: Record<string, unknown>;
  seo: unknown;
  draftVersion: number;
  publishedVersion: number | null;
  publishedSlug: string | null;
  publishedAt: Date | null;
  hasUnpublishedChanges: boolean;
  createdByEmail: string;
  updatedAt: Date;
}

export async function getEntry(id: string): Promise<EntryDetail | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await ContentEntry.findById(id).lean();
  if (!doc) return null;
  return {
    id: String(doc._id),
    type: doc.type,
    slug: doc.slug,
    status: doc.status,
    data: doc.draft,
    seo: doc.draftSeo,
    draftVersion: doc.draftVersion,
    publishedVersion: doc.publishedVersion ?? null,
    publishedSlug: doc.publishedSlug ?? null,
    publishedAt: doc.publishedAt ?? null,
    hasUnpublishedChanges: doc.status === "published" && (doc.publishedVersion ?? 0) !== doc.draftVersion,
    createdByEmail: doc.createdByEmail,
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
  };
}

export interface RevisionRow {
  id: string;
  version: number;
  event: ContentEvent;
  title: string;
  actorEmail: string;
  createdAt: Date;
}

export async function listRevisions(entryId: string, limit = 25): Promise<RevisionRow[]> {
  if (!isObjectId(entryId)) return [];
  await connectToDatabase();
  const docs = await ContentRevision.find({ entryId }).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    version: doc.version,
    event: doc.event,
    title: doc.title,
    actorEmail: doc.actorEmail,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt,
  }));
}

/** Live services, for the "related service" choice on a case study. */
export async function listPublishedServiceOptions(): Promise<{ slug: string; title: string }[]> {
  await connectToDatabase();
  const docs = await ContentEntry.find({ type: "service", status: "published" })
    .sort({ publishedAt: 1 })
    .lean();
  return docs
    .filter((doc) => typeof doc.publishedSlug === "string")
    .map((doc) => ({
      slug: doc.publishedSlug as string,
      title: titleOf(doc.published) || (doc.publishedSlug as string),
    }));
}
