import { ContentPreviewView } from "@/components/admin/content/content-preview-view";

export const metadata = { title: "Preview article" };

export default function PreviewArticlePage(props: { params: Promise<{ id: string }> }) {
  return <ContentPreviewView type="article" params={props.params} />;
}
