import { ContentListView } from "@/components/admin/content/content-list-view";

export const metadata = { title: "FAQs" };

export default function FaqsAdminPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContentListView type="faq" searchParams={props.searchParams} />;
}
