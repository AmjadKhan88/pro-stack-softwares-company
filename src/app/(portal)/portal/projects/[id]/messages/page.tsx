import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageThread } from "@/components/messages/message-thread";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authorizeConversation } from "@/features/messages/access";
import { canClientMessage } from "@/features/messages/rules";
import { listMessages } from "@/features/messages/service";

export async function generateMetadata() {
  return { title: "Messages" };
}

export default async function PortalMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only a client of this project's own organization gets past here. Everyone else sees "not found".
  const access = await authorizeConversation(id);
  if (!access.ok || access.side !== "client") notFound();

  const { messages, hasMore } = await listMessages(access.project.id, access.user.id);

  return (
    <div className="space-y-6">
      <Link
        href={`/portal/projects/${access.project.id}`}
        className="text-accent text-sm font-medium hover:underline"
      >
        ← {access.project.title}
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Talk to the team about {access.project.title}.</p>
      </header>
      <AutoRefresh />
      <Card>
        <CardContent className="py-5">
          <MessageThread messages={messages} hasMore={hasMore} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Reply</CardTitle>
        </CardHeader>
        <CardContent>
          {canClientMessage(access.project.status) ? (
            <MessageComposer projectId={access.project.id} />
          ) : (
            <p className="text-muted-foreground text-sm">
              This project is closed, so new messages can't be sent.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
