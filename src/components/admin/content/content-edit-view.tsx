import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentForm } from "@/components/admin/content/content-form";
import { ContentLifecycle } from "@/components/admin/content/content-lifecycle";
import { RestoreRevisionForm } from "@/components/admin/content/restore-revision-form";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toFormValues } from "@/features/cms/mapping";
import { getEntry, listPublishedServiceOptions, listRevisions } from "@/features/cms/service";
import {
  CONTENT_EVENT_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_TONE,
  CONTENT_TYPE_INFO,
  isEditable,
  type ContentType,
} from "@/features/cms/types";
import { formatDateTimeUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/permissions";
import { getMediaViewsByIds } from "@/features/media/service";

export async function ContentEditView({
  type,
  params,
}: {
  type: ContentType;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const info = CONTENT_TYPE_INFO[type];
  const user = await requirePermission("content.edit", `${info.adminPath}/${id}`);
  const entry = await getEntry(id);
  // A case study can't be opened under the services address, or the other way round.
  if (!entry || entry.type !== type) notFound();

  const imageId = typeof entry.data.imageAssetId === "string" ? entry.data.imageAssetId : undefined;
  const ogValue = (entry.seo as { ogImageAssetId?: unknown } | null)?.ogImageAssetId;
  const ogImageId = typeof ogValue === "string" ? ogValue : undefined;

  const [revisions, serviceOptions, media] = await Promise.all([
    listRevisions(entry.id),
    type === "case_study" ? listPublishedServiceOptions() : Promise.resolve([]),
    getMediaViewsByIds([imageId, ogImageId].filter((id): id is string => Boolean(id))),
  ]);

  const canPublish = can(user.role, "content.publish");
  const editable = isEditable(entry.status);
  const title = typeof entry.data.title === "string" && entry.data.title ? entry.data.title : entry.slug;

  return (
    <div className="space-y-6">
      <Link href={info.adminPath} className="text-accent text-sm font-medium hover:underline">
        ← All {info.plural.toLowerCase()}
      </Link>
      <PageHeader
        eyebrow={info.singular}
        title={title}
        actions={
          <Button asChild variant="outline">
            <Link href={`${info.adminPath}/${entry.id}/preview`}>Preview draft</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardContent className="py-5">
            {editable ? (
              <ContentForm
                type={type}
                mode="edit"
                entry={{ id: entry.id, version: entry.draftVersion, live: entry.status === "published" }}
                defaults={toFormValues(type, entry.slug, entry.data, entry.seo)}
                serviceOptions={serviceOptions}
                images={{
                  image: imageId ? { id: imageId, view: media[imageId] ?? null } : undefined,
                  ogImage: ogImageId ? { id: ogImageId, view: media[ogImageId] ?? null } : undefined,
                }}
              />
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed">
                This item is archived, so it can&apos;t be edited. Restore it as a draft to continue.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <StatusPill status={CONTENT_STATUS_TONE[entry.status]}>
                {CONTENT_STATUS_LABELS[entry.status]}
              </StatusPill>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                {entry.publishedSlug ? (
                  <p>
                    <span className="text-muted-foreground">Live at: </span>
                    <Link
                      href={`${info.publicPath}/${entry.publishedSlug}`}
                      className="text-accent font-medium hover:underline"
                    >
                      {info.publicPath}/{entry.publishedSlug}
                    </Link>
                  </p>
                ) : null}
                {entry.hasUnpublishedChanges ? (
                  <p className="text-sm font-medium">
                    Your saved draft has changes that aren&apos;t public yet.
                  </p>
                ) : null}
                {entry.publishedAt ? (
                  <p className="tabular-nums">
                    <span className="text-muted-foreground">First published: </span>
                    {formatDateTimeUtc(entry.publishedAt)}
                  </p>
                ) : null}
                <p className="tabular-nums">
                  <span className="text-muted-foreground">Last saved: </span>
                  {formatDateTimeUtc(entry.updatedAt)}
                </p>
                <p>
                  <span className="text-muted-foreground">Created by: </span>
                  {entry.createdByEmail}
                </p>
              </div>
              <ContentLifecycle
                entryId={entry.id}
                status={entry.status}
                version={entry.draftVersion}
                hasUnpublishedChanges={entry.hasUnpublishedChanges}
                canEdit
                canPublish={canPublish}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {revisions.map((revision) => (
                  <li key={revision.id} className="space-y-1 text-sm">
                    <p className="font-medium">
                      {CONTENT_EVENT_LABELS[revision.event]}
                      <span className="text-muted-foreground font-normal"> · version {revision.version}</span>
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {revision.actorEmail} · {formatDateTimeUtc(revision.createdAt)}
                    </p>
                    {editable && revision.version !== entry.draftVersion ? (
                      <RestoreRevisionForm
                        entryId={entry.id}
                        revisionId={revision.id}
                        version={entry.draftVersion}
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
