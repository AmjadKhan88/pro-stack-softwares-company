import { ContentListView } from "@/components/admin/content/content-list-view";

export const metadata = { title: "Pages" };

export default function PagesAdminPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContentListView type="page" searchParams={props.searchParams} />;
}
