import { NotificationsView } from "@/components/notifications/notifications-view";
import { requireClientContext } from "@/features/organizations/context";

export const metadata = { title: "Notifications" };

export default async function PortalNotificationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireClientContext("/portal/notifications");
  return <NotificationsView user={user} basePath="/portal/notifications" searchParams={props.searchParams} />;
}
