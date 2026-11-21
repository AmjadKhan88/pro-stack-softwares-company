import { ContentEditView } from "@/components/admin/content/content-edit-view";

export const metadata = { title: "Edit FAQ" };

export default function EditFaqPage(props: { params: Promise<{ id: string }> }) {
  return <ContentEditView type="faq" params={props.params} />;
}
