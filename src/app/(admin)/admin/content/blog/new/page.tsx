import { ContentNewView } from "@/components/admin/content/content-new-view";

export const metadata = { title: "New article" };

export default function NewArticlePage() {
  return <ContentNewView type="article" />;
}
