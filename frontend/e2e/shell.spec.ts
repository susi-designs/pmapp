import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("shows the app shell after signing in", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText("Kanban", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("column").first()).toBeVisible();
});

test("toggles between light and dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page);
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test("follows the system dark preference", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
});
