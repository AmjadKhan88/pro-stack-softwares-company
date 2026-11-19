import { ContentEditView } from "@/components/admin/content/content-edit-view";

export const metadata = { title: "Edit service" };

export default function EditServicePage(props: { params: Promise<{ id: string }> }) {
  return <ContentEditView type="service" params={props.params} />;
}
