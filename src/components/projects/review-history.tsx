import { REVIEW_EVENT_LABELS } from "@/features/projects/review";
import type { ReviewEventView } from "@/features/projects/review-service";
import { formatDateTimeUtc } from "@/lib/format";

export function ReviewHistory({ events }: { events: ReviewEventView[] }) {
  if (events.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="text-accent cursor-pointer font-medium">Review history ({events.length})</summary>
      <ol className="border-border mt-3 space-y-3 border-l pl-4">
        {events.map((event) => (
          <li key={event.id} className="space-y-1">
            <p className="font-medium">
              {REVIEW_EVENT_LABELS[event.type]}
              {event.round > 0 ? (
                <span className="text-muted-foreground font-normal"> · round {event.round}</span>
              ) : null}
            </p>
            {event.message ? <p className="leading-relaxed whitespace-pre-wrap">{event.message}</p> : null}
            <p className="text-muted-foreground text-xs tabular-nums">
              {event.actorName} · {formatDateTimeUtc(event.createdAt)}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}
