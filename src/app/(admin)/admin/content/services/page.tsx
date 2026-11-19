import { ContentListView } from "@/components/admin/content/content-list-view";

export const metadata = { title: "Services" };

export default function ServicesAdminPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContentListView type="service" searchParams={props.searchParams} />;
}
