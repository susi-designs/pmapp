import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";
import { renderWithProviders } from "@/test/render";

test("toggles the dark theme", async () => {
  renderWithProviders(<ThemeToggle />);
  const toggle = screen.getByRole("button", { name: "Toggle theme" });
  await userEvent.click(toggle);
  expect(document.documentElement).toHaveClass("dark");
  await userEvent.click(toggle);
  expect(document.documentElement).not.toHaveClass("dark");
});
