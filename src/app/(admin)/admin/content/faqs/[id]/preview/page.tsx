import { ContentPreviewView } from "@/components/admin/content/content-preview-view";

export const metadata = { title: "Preview FAQ" };

export default function PreviewFaqPage(props: { params: Promise<{ id: string }> }) {
  return <ContentPreviewView type="faq" params={props.params} />;
}
