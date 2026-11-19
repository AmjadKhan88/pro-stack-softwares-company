import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseStudyBody } from "@/components/public-site/case-study-detail";
import { ServiceDetailBody } from "@/components/public-site/service-detail";
import { getCaseStudies, getServiceBySlug } from "@/features/content/repository";
import { toPublicCaseStudy, toPublicService } from "@/features/cms/mapping";
import { getEntry } from "@/features/cms/service";
import { CONTENT_TYPE_INFO, type ContentType } from "@/features/cms/types";
import { requirePermission } from "@/server/auth/session";

/** Shows the saved DRAFT the way visitors would see it. Staff-only and never public. */
export async function ContentPreviewView({
  type,
  params,
}: {
  type: ContentType;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const info = CONTENT_TYPE_INFO[type];
  await requirePermission("content.edit", `${info.adminPath}/${id}/preview`);
  const entry = await getEntry(id);
  if (!entry || entry.type !== type) notFound();

  const item = { slug: entry.slug, data: entry.data, seo: entry.seo };

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="border-border bg-surface-muted flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
      >
        <span className="font-medium">Preview of your saved draft. Visitors can&apos;t see this.</span>
        <Link href={`${info.adminPath}/${entry.id}`} className="text-accent font-medium hover:underline">
          ← Back to editing
        </Link>
      </div>

      {type === "service" ? <ServicePreview item={item} /> : <CaseStudyPreview item={item} />}
    </div>
  );
}

async function ServicePreview({ item }: { item: { slug: string; data: unknown; seo: unknown } }) {
  const service = toPublicService(item);
  if (!service) return <IncompleteNotice />;
  const related = (await getCaseStudies()).filter((c) => c.serviceSlug === service.slug);
  return (
    <div className="space-y-6">
      <ServiceDetailBody service={service} related={related} />
    </div>
  );
}

async function CaseStudyPreview({ item }: { item: { slug: string; data: unknown; seo: unknown } }) {
  const study = toPublicCaseStudy(item);
  if (!study) return <IncompleteNotice />;
  const service = study.serviceSlug ? await getServiceBySlug(study.serviceSlug) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <CaseStudyBody study={study} service={service} />
    </div>
  );
}

function IncompleteNotice() {
  return <p className="text-muted-foreground text-sm">Add a title and a summary to see a preview.</p>;
}
