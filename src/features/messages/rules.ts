// Rules for project messages. Pure (no I/O) so every rule is easy to read and to test.

export const MAX_MESSAGE_LENGTH = 4000;
export const MESSAGE_LIMIT = 30;
export const MESSAGE_WINDOW_SECONDS = 10 * 60;
/** How many of the latest messages a conversation page shows. */
export const THREAD_SIZE = 100;

/**
 * Tidies what someone typed: normal line endings, no control characters, no more than one blank line in a row,
 * no spaces at the ends. It is always shown as plain text, never as HTML.
 */
export function cleanMessageBody(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, "\n")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Clients can write on any of their projects except a cancelled one. */
export function canClientMessage(projectStatus: string): boolean {
  return projectStatus !== "cancelled";
}

export type Side = "client" | "staff";
