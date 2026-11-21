import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/public-site/rich-text";

describe("drawing rich text", () => {
  it("shows dangerous-looking text as words and creates no script, image or unsafe link", () => {
    const { container } = render(
      <RichText
        source={
          "<script>alert(1)</script> <img src=x onerror=alert(1)> [bad](javascript:alert(1)) [good](https://example.com)"
        }
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    const anchors = [...container.querySelectorAll("a")];
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe("https://example.com");
    expect(anchors[0].getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.innerHTML).not.toMatch(/javascript:/i);
  });

  it("draws headings, lists and a site link", () => {
    const { container } = render(
      <RichText source={"## Hello\n\n- one\n- two\n\nSee [contact](/contact)."} />,
    );
    expect(container.querySelector("h2")?.textContent).toBe("Hello");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector('a[href="/contact"]')).not.toBeNull();
  });
});
