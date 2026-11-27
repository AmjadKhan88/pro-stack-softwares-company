import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageThread } from "@/components/messages/message-thread";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { authorizeConversation } from "@/features/messages/access";
import { listMessages } from "@/features/messages/service";

export async function generateMetadata() {
  return { title: "Messages" };
}

export default async function AdminProjectMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Staff who can read this project (developers: only if assigned). Everyone else sees "not found".
  const access = await authorizeConversation(id);
  if (!access.ok || access.side !== "staff") notFound();

  const { messages, hasMore } = await listMessages(access.project.id, access.user.id);

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/projects/${access.project.id}`}
        className="text-accent text-sm font-medium hover:underline"
      >
        ← {access.project.title}
      </Link>
      <PageHeader
        eyebrow="Project conversation"
        title="Messages"
        description={`The client sees everything written here. Project: ${access.project.title}.`}
      />
      <AutoRefresh projectId={access.project.id} />
      <Card>
        <CardContent className="py-5">
          <MessageThread messages={messages} hasMore={hasMore} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Reply to the client</CardTitle>
        </CardHeader>
        <CardContent>
          <MessageComposer projectId={access.project.id} />
        </CardContent>
      </Card>
    </div>
  );
}
