import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { adminNav, portalNav, publicNav } from "@/config/navigation";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/badge";

vi.mock("next/navigation", () => ({ usePathname: () => "/portal" }));

describe("navigation shells", () => {
  it("renders ready items as links and marks the current page", () => {
    render(<NavLink item={portalNav[0].items[0]} variant="light" />);
    expect(screen.getByRole("link", { name: /overview/i })).toHaveAttribute("aria-current", "page");
  });

  it("renders unbuilt routes as disabled text, never as dead links", () => {
    const pending = publicNav.find((i) => !i.ready)!;
    render(<NavLink item={pending} variant="top" />);
    expect(screen.queryByRole("link", { name: pending.label })).toBeNull();
    expect(screen.getByText(pending.label).closest("[aria-disabled]")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("only exposes routes that exist as ready", () => {
    const readyHrefs = [
      ...publicNav,
      ...portalNav.flatMap((g) => g.items),
      ...adminNav.flatMap((g) => g.items),
    ]
      .filter((i) => i.ready)
      .map((i) => i.href)
      .sort();
    expect(readyHrefs).toEqual(["/", "/admin", "/contact", "/portal"]);
  });
});

describe("ui primitives", () => {
  it("Button defaults to type=button", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("FormField links label, hint and error to the control", () => {
    render(
      <FormField id="email" label="Email" error="Enter a valid email.">
        {(c) => <Input {...c} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email.");
  });

  it("StatusPill always includes a text label", () => {
    render(<StatusPill status="blocked">Blocked</StatusPill>);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});
