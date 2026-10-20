import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";

describe("theme foundation", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("renders three accessible theme options", () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    expect(screen.getByRole("group", { name: /colour theme/i })).toBeInTheDocument();
    for (const name of [/light theme/i, /dark theme/i, /system theme/i]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("applies the dark class and persists the choice", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /dark theme/i }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: /dark theme/i })).toHaveAttribute("aria-pressed", "true");
  });
});
