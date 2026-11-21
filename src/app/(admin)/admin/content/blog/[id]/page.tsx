import { ContentEditView } from "@/components/admin/content/content-edit-view";

export const metadata = { title: "Edit article" };

export default function EditArticlePage(props: { params: Promise<{ id: string }> }) {
  return <ContentEditView type="article" params={props.params} />;
}
