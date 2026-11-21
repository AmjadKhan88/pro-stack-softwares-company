import Link from "next/link";
import { ContentForm } from "@/components/admin/content/content-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listPublishedServiceOptions } from "@/features/cms/service";
import { CONTENT_TYPE_INFO, type ContentType } from "@/features/cms/types";
import { requirePermission } from "@/server/auth/session";

export async function ContentNewView({ type }: { type: ContentType }) {
  const info = CONTENT_TYPE_INFO[type];
  await requirePermission("content.edit", `${info.adminPath}/new`);
  const serviceOptions = type === "case_study" ? await listPublishedServiceOptions() : [];

  return (
    <div className="space-y-6">
      <Link href={info.adminPath} className="text-accent text-sm font-medium hover:underline">
        ← All {info.nounPlural}
      </Link>
      <PageHeader
        eyebrow="Website"
        title={`New ${info.noun}`}
        description="It starts as a draft. Nothing is public until you publish."
      />
      <Card>
        <CardContent className="py-5">
          <ContentForm type={type} mode="create" defaults={{}} serviceOptions={serviceOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
