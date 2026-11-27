import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { visibleProjectIds } from "@/features/projects/access";
import { projectAccessScope } from "@/features/projects/access-rules";
import { listConversations } from "@/features/messages/service";
import { formatDateTimeUtc } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Messages" };

export default async function AdminMessagesPage() {
  const user = await requireStaff("/admin/messages");
  if (projectAccessScope(user.role) === "none") notFound();

  // A developer only receives the conversations of projects they are assigned to.
  const conversations = await listConversations(await visibleProjectIds(user));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Messages"
        description="Project conversations with clients. Start one from a project's page."
      />
      <Card>
        {conversations.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No conversations yet"
              description="They appear here once a client or a team member sends a message on a project."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Client</Th>
                <Th>Messages</Th>
                <Th>Last message</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr key={conversation.projectId}>
                  <Td className="font-medium">
                    <Link
                      href={`/admin/projects/${conversation.projectId}/messages`}
                      className="hover:underline"
                    >
                      {conversation.projectTitle}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{conversation.organizationName ?? "—"}</Td>
                  <Td className="tabular-nums">{conversation.count}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateTimeUtc(conversation.lastAt)}</Td>
                  <Td>
                    {conversation.lastAuthorType === "client" ? (
                      <StatusPill status="review">Waiting for a reply</StatusPill>
                    ) : (
                      <StatusPill status="live">Replied</StatusPill>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
