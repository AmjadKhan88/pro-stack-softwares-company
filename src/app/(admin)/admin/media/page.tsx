import Image from "next/image";
import { AltTextForm, ArchiveAssetForm } from "@/components/admin/media/asset-forms";
import { UploadForm } from "@/components/admin/media/upload-form";
import { Pagination } from "@/components/lists/pagination";
import { SearchBar } from "@/components/lists/search-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { parseMediaFilters } from "@/features/media/schema";
import { listAssets } from "@/features/media/service";
import { formatBytes } from "@/features/media/rules";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Media library" };

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("content.edit", "/admin/media");
  const filters = parseMediaFilters(await searchParams);
  const list = await listAssets(filters);
  const filtered = Boolean(filters.q || filters.status);
  const archivedView = filters.status === "archived";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website"
        title="Media library"
        description="Pictures for services and case studies. Choose them from the content editors."
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload an image</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>

      <SearchBar
        basePath="/admin/media"
        q={filters.q}
        placeholder="File name or description"
        hasFilters={filtered}
        selects={[
          {
            name: "status",
            label: "Show",
            value: filters.status,
            allLabel: "Active images",
            options: [
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />

      {list.rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No images match" : "No images yet"}
          description={filtered ? "Try a different search." : "Upload your first image above."}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.rows.map((asset) => (
            <li key={asset.id}>
              <Card className="h-full">
                <div className="bg-surface-muted relative aspect-[4/3] overflow-hidden rounded-t-xl">
                  <Image
                    src={asset.url}
                    alt={asset.alt}
                    fill
                    sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                    className="object-contain"
                  />
                </div>
                <CardContent className="space-y-3 py-4">
                  <div>
                    <p className="truncate text-sm font-medium" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {asset.width}×{asset.height} · {asset.format.toUpperCase()} · {formatBytes(asset.bytes)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {asset.usage === 0
                        ? "Not used yet"
                        : `Used by ${asset.usage} content ${asset.usage === 1 ? "item" : "items"}`}
                    </p>
                  </div>
                  <AltTextForm assetId={asset.id} alt={asset.alt} />
                  <ArchiveAssetForm assetId={asset.id} archived={archivedView} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/admin/media"
        params={{ q: filters.q, status: filters.status }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={["image", "images"]}
      />
    </div>
  );
}
