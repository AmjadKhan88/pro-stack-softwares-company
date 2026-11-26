import Link from "next/link";
import { Bell } from "lucide-react";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { Pagination } from "@/components/lists/pagination";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/features/notifications/actions";
import { countUnread, getEmailPreferences, listNotifications } from "@/features/notifications/service";
import { categoriesFor, categoryText, wantsEmail } from "@/features/notifications/types";
import { formatDateTimeUtc } from "@/lib/format";
import { firstParam, parsePageParam } from "@/lib/search";
import type { SessionUser } from "@/server/auth/session";

export async function NotificationsView({
  user,
  basePath,
  searchParams,
}: {
  user: SessionUser;
  basePath: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const unreadOnly = firstParam(params.filter) === "unread";
  const page = parsePageParam(params.page);
  const [list, unread, stored] = await Promise.all([
    listNotifications(user.id, { page, unreadOnly }),
    countUnread(user.id),
    getEmailPreferences(user.id),
  ]);

  const options = categoriesFor(user.role).map((category) => ({
    key: category,
    ...categoryText(user.role, category),
    checked: wantsEmail(user.role, category, stored),
  }));
  const tab = "rounded-full border px-3 py-1 text-sm transition-colors";
  const idle = `${tab} border-border bg-surface text-muted-foreground hover:text-foreground`;
  const active = `${tab} border-primary bg-primary text-primary-foreground`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Notifications"
        description="Updates about your work, kept here so nothing is missed."
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline" size="sm">
                Mark all as read
              </Button>
            </form>
          ) : undefined
        }
      />

      <nav aria-label="Filter notifications" className="flex gap-2">
        <Link
          href={basePath}
          className={unreadOnly ? idle : active}
          aria-current={unreadOnly ? undefined : "true"}
        >
          All
        </Link>
        <Link
          href={`${basePath}?filter=unread`}
          className={unreadOnly ? active : idle}
          aria-current={unreadOnly ? "true" : undefined}
        >
          Unread ({unread})
        </Link>
      </nav>

      {list.rows.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title={unreadOnly ? "No unread notifications" : "No notifications yet"}
          description={
            unreadOnly
              ? "You're all caught up."
              : "When something happens that needs your attention, it will appear here."
          }
        />
      ) : (
        <Card>
          <ul className="divide-border divide-y">
            {list.rows.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <a
                  href={`/api/notifications/${item.id}/open`}
                  className="min-w-0 flex-1 space-y-1 hover:underline"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={item.read ? "text-sm" : "text-sm font-semibold"}>{item.title}</span>
                    {item.read ? null : <StatusPill status="review">New</StatusPill>}
                  </span>
                  {item.body ? (
                    <span className="text-muted-foreground block text-sm">{item.body}</span>
                  ) : null}
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {formatDateTimeUtc(item.createdAt)}
                  </span>
                </a>
                {item.read ? null : (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Mark as read
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pagination
        basePath={basePath}
        params={{ filter: unreadOnly ? "unread" : undefined }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={["notification", "notifications"]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Choose what we also send to your email. Emails only say that something new is waiting. They never
            contain project details. You always see everything here, whatever you choose.
          </p>
          <PreferencesForm options={options} />
        </CardContent>
      </Card>
    </div>
  );
}
