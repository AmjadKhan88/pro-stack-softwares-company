// A deliberately small rich-text format. It is parsed into plain data and drawn as plain React elements, so
// nothing an editor types can ever become HTML, a script or an event handler. Unknown syntax is just text.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type BlockNode =
  | { type: "paragraph"; children: Inline[] }
  | { type: "heading"; level: 2 | 3; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] };

const MAX_SOURCE = 20_000;
const MAX_DEPTH = 3;
const MAX_NODES = 500;

/**
 * The only links that are ever allowed: a page on this site, https, mailto and tel.
 * Everything else (javascript:, data:, http:, //host, links with passwords...) returns null.
 */
export function safeHref(input: string): string | null {
  const url = input.trim();
  // eslint-disable-next-line no-control-regex
  if (!url || url.length > 500 || /[\s\u0000-\u001f\u007f]/.test(url)) return null;
  if (url.startsWith("/")) return url.startsWith("//") || url.includes("\\") ? null : url;
  if (/^https:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null;
      return url;
    } catch {
      return null;
    }
  }
  if (/^mailto:[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/i.test(url)) return url;
  if (/^tel:\+?[0-9][0-9-]{5,20}$/i.test(url)) return url;
  return null;
}

const LINK = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/y;

/** The next lone "*" (not part of "**"), or -1. */
function findSingleStar(text: string, from: number): number {
  let index = from;
  while (index < text.length) {
    const found = text.indexOf("*", index);
    if (found === -1) return -1;
    if (text[found + 1] === "*") {
      index = found + 2;
      continue;
    }
    return found;
  }
  return -1;
}

function parseInline(text: string, depth: number, allowLinks: boolean): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // A backslash makes the next formatting character literal: \* \[ \` ...
    if (ch === "\\" && i + 1 < text.length && /[\\`*[\]()#>_-]/.test(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "[" && allowLinks) {
      LINK.lastIndex = i;
      const match = LINK.exec(text);
      if (match) {
        flush();
        const label = match[1];
        const children: Inline[] =
          depth < MAX_DEPTH ? parseInline(label, depth + 1, false) : [{ type: "text", text: label }];
        const href = safeHref(match[2]);
        // An unsafe address keeps the words and drops the link.
        if (href) out.push({ type: "link", href, children });
        else out.push(...children);
        i += match[0].length;
        continue;
      }
    }

    if (ch === "*" && text[i + 1] === "*" && depth < MAX_DEPTH) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "strong", children: parseInline(text.slice(i + 2, end), depth + 1, allowLinks) });
        i = end + 2;
        continue;
      }
    } else if (ch === "*" && depth < MAX_DEPTH) {
      const end = findSingleStar(text, i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "em", children: parseInline(text.slice(i + 1, end), depth + 1, allowLinks) });
        i = end + 1;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

const HEADING = /^(#{2,3})\s+(.+)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*\d{1,3}[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

function startsBlock(line: string): boolean {
  return HEADING.test(line) || BULLET.test(line) || ORDERED.test(line) || QUOTE.test(line);
}

export function parseRichText(source: string): BlockNode[] {
  const lines = source.slice(0, MAX_SOURCE).replace(/\r\n?/g, "\n").split("\n");
  const nodes: BlockNode[] = [];
  let i = 0;

  while (i < lines.length && nodes.length < MAX_NODES) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      nodes.push({
        type: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        children: parseInline(heading[2].trim(), 0, true),
      });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line) && !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(parseInline((pattern.exec(lines[i]) as RegExpExecArray)[1].trim(), 0, true));
        i += 1;
      }
      nodes.push({ type: "list", ordered, items });
      continue;
    }

    if (QUOTE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        parts.push((QUOTE.exec(lines[i]) as RegExpExecArray)[1].trim());
        i += 1;
      }
      nodes.push({ type: "quote", children: parseInline(parts.join(" ").trim(), 0, true) });
      continue;
    }

    const parts: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && (parts.length === 0 || !startsBlock(lines[i]))) {
      parts.push(lines[i].trim());
      i += 1;
    }
    nodes.push({ type: "paragraph", children: parseInline(parts.join(" "), 0, true) });
  }
  return nodes;
}

function inlineText(items: Inline[]): string {
  return items
    .map((item) => (item.type === "text" || item.type === "code" ? item.text : inlineText(item.children)))
    .join("");
}

/** The words only, with all formatting removed (for search-engine data and reading time). */
export function plainText(source: string): string {
  return parseRichText(source)
    .map((node) => (node.type === "list" ? node.items.map(inlineText).join(" ") : inlineText(node.children)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(source: string): number {
  const text = plainText(source);
  return text ? text.split(" ").length : 0;
}
