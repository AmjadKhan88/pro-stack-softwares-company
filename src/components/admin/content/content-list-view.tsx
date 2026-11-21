import Link from "next/link";
import { Pagination } from "@/components/lists/pagination";
import { SearchBar } from "@/components/lists/search-bar";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { parseContentFilters } from "@/features/cms/list-params";
import { listEntries } from "@/features/cms/service";
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_TONE,
  CONTENT_TYPE_INFO,
  type ContentType,
} from "@/features/cms/types";
import { formatDateUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";

const DESCRIPTIONS: Record<ContentType, string> = {
  service: "Write services as drafts, preview them, and publish when they're ready.",
  case_study: "Write case studies as drafts, preview them, and publish when they're ready.",
  article: "Write articles for the Insights section. Nothing is public until you publish.",
  page: "Pages such as Privacy and Terms. Publishing a page with the address “about” or “process” replaces that built-in page.",
  faq: "Questions and answers for the FAQ page. Published entries replace the sample ones.",
};

export async function ContentListView({
  type,
  searchParams,
}: {
  type: ContentType;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const info = CONTENT_TYPE_INFO[type];
  await requirePermission("content.edit", info.adminPath);
  const filters = parseContentFilters(await searchParams);
  const list = await listEntries(type, filters);
  const filtered = Boolean(filters.q || filters.status);
  const isFaq = type === "faq";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website"
        title={info.plural}
        description={DESCRIPTIONS[type]}
        actions={
          <Button asChild variant="accent">
            <Link href={`${info.adminPath}/new`}>New {info.noun}</Link>
          </Button>
        }
      />

      <SearchBar
        basePath={info.adminPath}
        q={filters.q}
        placeholder={isFaq ? "Question" : "Title or URL slug"}
        hasFilters={filtered}
        selects={[
          {
            name: "status",
            label: "Status",
            value: filters.status,
            allLabel: "Active (not archived)",
            options: CONTENT_STATUSES.map((value) => ({ value, label: CONTENT_STATUS_LABELS[value] })),
          },
        ]}
      />

      <Card>
        {list.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filtered ? "Nothing matches" : `No ${info.nounPlural} yet`}
              description={
                filtered
                  ? "Try a different search or status."
                  : `Create the first one. Nothing is public until you publish it.`
              }
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{isFaq ? "Question" : "Title"}</Th>
                {isFaq ? null : <Th>URL slug</Th>}
                <Th>Status</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">
                    <Link href={`${info.adminPath}/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                  </Td>
                  {isFaq ? null : <Td className="text-muted-foreground font-mono text-xs">{row.slug}</Td>}
                  <Td>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill status={CONTENT_STATUS_TONE[row.status]}>
                        {CONTENT_STATUS_LABELS[row.status]}
                      </StatusPill>
                      {row.hasUnpublishedChanges ? (
                        <StatusPill status="review">Unpublished changes</StatusPill>
                      ) : null}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateUtc(row.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        basePath={info.adminPath}
        params={{ q: filters.q, status: filters.status }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={[info.noun, info.nounPlural]}
      />
    </div>
  );
}
