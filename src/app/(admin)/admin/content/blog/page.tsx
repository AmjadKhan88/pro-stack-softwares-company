import { ContentListView } from "@/components/admin/content/content-list-view";

export const metadata = { title: "Articles" };

export default function ArticlesAdminPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContentListView type="article" searchParams={props.searchParams} />;
}
