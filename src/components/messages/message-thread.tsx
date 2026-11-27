import { StatusPill } from "@/components/ui/badge";
import type { MessageView } from "@/features/messages/state";
import { formatDateTimeUtc } from "@/lib/format";

/** Messages are drawn as plain text: nothing typed here can become HTML. */
export function MessageThread({ messages, hasMore }: { messages: MessageView[]; hasMore: boolean }) {
  if (messages.length === 0) {
    return <p className="text-muted-foreground text-sm">No messages yet. Say hello below.</p>;
  }
  return (
    <div className="space-y-4">
      {hasMore ? <p className="text-muted-foreground text-xs">Showing the latest 100 messages.</p> : null}
      <ol className="space-y-4" aria-label="Messages">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`border-border max-w-[85%] space-y-1.5 rounded-xl border p-4 ${
              message.mine ? "bg-surface-muted ml-auto" : "bg-surface"
            }`}
          >
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{message.mine ? "You" : message.authorName}</span>
              <StatusPill status={message.authorType === "staff" ? "live" : "review"}>
                {message.authorType === "staff" ? "Team" : "Client"}
              </StatusPill>
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatDateTimeUtc(message.createdAt)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
