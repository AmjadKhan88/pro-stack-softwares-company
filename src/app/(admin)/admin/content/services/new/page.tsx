import { ContentNewView } from "@/components/admin/content/content-new-view";

export const metadata = { title: "New service" };

export default function NewServicePage() {
  return <ContentNewView type="service" />;
}
