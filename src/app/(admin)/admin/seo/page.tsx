import Link from "next/link";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { CONTENT_TYPE_INFO } from "@/features/cms/types";
import { summarize, type Severity } from "@/features/seo/audit";
import { loadSeoRows } from "@/features/seo/audit-service";
import { isIndexingAllowed } from "@/lib/seo";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "SEO overview" };

const LABEL: Record<Severity, string> = { problem: "Problem", warning: "Tip", info: "Note" };
const STYLE: Record<Severity, string> = {
  problem: "text-danger font-medium",
  warning: "font-medium",
  info: "text-muted-foreground",
};

const SHARE_IMAGE = { own: "Own image", main: "Main image", none: "None" } as const;
const DESCRIPTION = { custom: "Custom", summary: "From the summary", none: "None" } as const;

export default async function SeoPage() {
  await requirePermission("content.edit", "/admin/seo");
  const rows = await loadSeoRows();
  const counts = summarize(rows);
  const launched = isIndexingAllowed();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website"
        title="SEO overview"
        description="How each published page will look to search engines and when it is shared. Fix the problems first."
      />

      <div
        role="note"
        className="border-border bg-surface-muted rounded-lg border px-4 py-3 text-sm leading-relaxed"
      >
        {launched ? (
          <>
            Search engines are <strong>allowed</strong> to index this website.
          </>
        ) : (
          <>
            Search engines are currently <strong>blocked from the whole website</strong> (it isn&apos;t
            launched yet). Everything below still applies for when you launch.
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Published pages"
          value={counts.total}
          hint="Services, case studies, articles, pages"
        />
        <StatCard label="With problems" value={counts.withProblems} attention />
        <StatCard label="With tips only" value={counts.withWarnings} />
        <StatCard label="Hidden from search engines" value={counts.hidden} />
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nothing published yet"
              description="Once you publish a service, case study, article or page, it appears here."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th>Description</Th>
                <Th>Sharing image</Th>
                <Th>Search engines</Th>
                <Th>What to fix</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td>
                    <Link
                      href={`${CONTENT_TYPE_INFO[row.type].adminPath}/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {CONTENT_TYPE_INFO[row.type].singular} · {row.url}
                    </p>
                  </Td>
                  <Td>{DESCRIPTION[row.descriptionSource]}</Td>
                  <Td>{SHARE_IMAGE[row.shareImage]}</Td>
                  <Td>{row.indexed ? "Listed" : "Hidden"}</Td>
                  <Td>
                    {row.issues.length === 0 ? (
                      <span className="text-success text-sm">All good</span>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {row.issues.map((issue) => (
                          <li key={issue.message} className={STYLE[issue.severity]}>
                            <span className="sr-only">{LABEL[issue.severity]}: </span>
                            <span aria-hidden>{LABEL[issue.severity]}: </span>
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="text-muted-foreground text-sm leading-relaxed">
        The built-in pages (home, contact and so on) aren&apos;t listed here. Their search settings are set in
        the code. Edit a page by clicking its name.
      </p>
    </div>
  );
}
