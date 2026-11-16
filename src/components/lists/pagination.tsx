import Link from "next/link";
import { listHref } from "@/lib/list-links";

export function Pagination({
  basePath,
  params,
  page,
  pageCount,
  total,
  noun,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  total: number;
  noun: [singular: string, plural: string];
}) {
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {pageCount} · {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      <span className="flex gap-4">
        {page > 1 ? (
          <Link
            href={listHref(basePath, { ...params, page: page - 1 })}
            className="text-accent font-medium hover:underline"
          >
            ← Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            href={listHref(basePath, { ...params, page: page + 1 })}
            className="text-accent font-medium hover:underline"
          >
            Next →
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
