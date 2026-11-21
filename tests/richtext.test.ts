import { describe, expect, it } from "vitest";
import { parseRichText, plainText, safeHref, wordCount, type Inline } from "@/features/cms/richtext";

const firstInlines = (source: string): Inline[] => {
  const node = parseRichText(source)[0];
  if (!node || node.type === "list") throw new Error("expected a text node");
  return node.children;
};

describe("which links are allowed", () => {
  it("allows a page on this site, https, mailto and tel", () => {
    for (const ok of [
      "/contact",
      "/insights/a-post",
      "https://example.com",
      "https://example.com/a?b=1#c",
      "mailto:hello@example.com",
      "tel:+923001234567",
    ]) {
      expect(safeHref(ok), ok).toBe(ok);
    }
  });

  it("refuses everything else", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "http://example.com",
      "//evil.example.com",
      "/\\evil.example.com",
      "https://user:pass@evil.example.com",
      "https://",
      "ftp://example.com",
      "mailto:not an address",
      "tel:abc",
      "#section",
      "relative/path",
      "https://exa mple.com",
      "https://example.com/\u0000",
      "",
      "x".repeat(501),
    ]) {
      expect(safeHref(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("blocks of rich text", () => {
  it("reads paragraphs, headings, lists and quotes", () => {
    const nodes = parseRichText(
      [
        "## Title",
        "",
        "First line",
        "second line",
        "",
        "- one",
        "- two",
        "",
        "1. a",
        "2. b",
        "",
        "> quoted",
        "> more",
        "",
        "### Sub",
      ].join("\n"),
    );
    expect(nodes.map((n) => n.type)).toEqual(["heading", "paragraph", "list", "list", "quote", "heading"]);
    expect(nodes[0]).toMatchObject({ type: "heading", level: 2 });
    expect(nodes[5]).toMatchObject({ type: "heading", level: 3 });
    expect(nodes[1]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", text: "First line second line" }],
    });
    expect(nodes[2]).toMatchObject({ type: "list", ordered: false });
    expect((nodes[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(nodes[3]).toMatchObject({ type: "list", ordered: true });
  });

  it("does not turn a single # into a heading, or *bold* into a list", () => {
    expect(parseRichText("# Not a heading")[0].type).toBe("paragraph");
    expect(parseRichText("*not a list*")[0].type).toBe("paragraph");
  });

  it("copes with empty and blank input", () => {
    expect(parseRichText("")).toEqual([]);
    expect(parseRichText("\n\n   \n")).toEqual([]);
  });
});

describe("inline formatting", () => {
  it("reads bold, italic, code and links", () => {
    const inlines = firstInlines("a **bold** and *italic* and `code` and [a link](https://example.com)");
    expect(inlines.map((i) => i.type)).toEqual([
      "text",
      "strong",
      "text",
      "em",
      "text",
      "code",
      "text",
      "link",
    ]);
    expect(inlines[7]).toMatchObject({ type: "link", href: "https://example.com" });
  });

  it("nests emphasis, and lets a backslash make a character literal", () => {
    expect(firstInlines("**a *b* c**")[0]).toMatchObject({ type: "strong" });
    expect(firstInlines("\\*not italic\\*")).toEqual([{ type: "text", text: "*not italic*" }]);
    expect(firstInlines("2 * 3 = 6")).toEqual([{ type: "text", text: "2 * 3 = 6" }]);
  });

  it("keeps unmatched markers as plain text", () => {
    expect(firstInlines("**never closed")).toEqual([{ type: "text", text: "**never closed" }]);
    expect(firstInlines("`never closed")).toEqual([{ type: "text", text: "`never closed" }]);
    expect(firstInlines("[no address]")).toEqual([{ type: "text", text: "[no address]" }]);
  });
});

describe("unsafe input stays as text", () => {
  it("never turns a script tag or an event handler into anything but words", () => {
    const text = "<script>alert(1)</script> <img src=x onerror=alert(1)> <a href='javascript:x'>hi</a>";
    expect(firstInlines(text)).toEqual([{ type: "text", text }]);
    expect(JSON.stringify(parseRichText(text))).not.toMatch(/"type":"(link|html)"/);
  });

  it("drops the link but keeps the words when the address is unsafe", () => {
    expect(firstInlines("[click me](javascript:alert(1))")).toEqual([{ type: "text", text: "click me" }]);
    expect(firstInlines("[x](http://example.com)")).toEqual([{ type: "text", text: "x" }]);
    expect(firstInlines("[x](//evil.example.com)")).toEqual([{ type: "text", text: "x" }]);
    expect(firstInlines("[x](data:text/html,hi)")).toEqual([{ type: "text", text: "x" }]);
  });

  it("does not allow a link inside a link", () => {
    const inlines = firstInlines("[outer [inner](https://a.example.com)](https://b.example.com)");
    const links = JSON.stringify(inlines).match(/"type":"link"/g) ?? [];
    expect(links.length).toBeLessThanOrEqual(1);
  });

  it("survives deep nesting, huge input and thousands of markers without hanging or throwing", () => {
    expect(() => parseRichText("*".repeat(3000))).not.toThrow();
    expect(() => parseRichText("[".repeat(5000))).not.toThrow();
    expect(() => parseRichText("**a ".repeat(3000))).not.toThrow();
    expect(() => parseRichText("`".repeat(4000))).not.toThrow();
    expect(() => parseRichText("- x\n".repeat(5000))).not.toThrow();
    expect(parseRichText("word ".repeat(50_000)).length).toBeLessThanOrEqual(500);
    const started = Date.now();
    parseRichText("[a](".repeat(2000));
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("plain words", () => {
  it("removes all formatting", () => {
    expect(plainText("## Title\n\nSome **bold** and [a link](https://example.com).\n\n- one\n- two")).toBe(
      "Title Some bold and a link. one two",
    );
    expect(wordCount("one two **three**")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});
