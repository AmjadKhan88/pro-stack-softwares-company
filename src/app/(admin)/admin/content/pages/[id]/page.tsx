import { ContentEditView } from "@/components/admin/content/content-edit-view";

export const metadata = { title: "Edit page" };

export default function EditPagePage(props: { params: Promise<{ id: string }> }) {
  return <ContentEditView type="page" params={props.params} />;
}
