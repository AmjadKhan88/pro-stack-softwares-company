import { ContentPreviewView } from "@/components/admin/content/content-preview-view";

export const metadata = { title: "Preview page" };

export default function PreviewPagePage(props: { params: Promise<{ id: string }> }) {
  return <ContentPreviewView type="page" params={props.params} />;
}
