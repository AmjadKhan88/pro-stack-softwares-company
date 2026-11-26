import { NotificationsView } from "@/components/notifications/notifications-view";
import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin/notifications");
  return <NotificationsView user={user} basePath="/admin/notifications" searchParams={props.searchParams} />;
}
