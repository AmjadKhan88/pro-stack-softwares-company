import { ContentPreviewView } from "@/components/admin/content/content-preview-view";

export const metadata = { title: "Preview service" };

export default function PreviewServicePage(props: { params: Promise<{ id: string }> }) {
  return <ContentPreviewView type="service" params={props.params} />;
}
