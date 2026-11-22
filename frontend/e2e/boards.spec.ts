import { expect, test, type Page } from "@playwright/test";
import { resetBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  await page.goto("/");
  await expect(page.getByTestId("card")).toHaveCount(8);
});

async function boardsMenu(page: Page, item: string) {
  await page.getByRole("button", { name: "Boards" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

test("creates a board with the default columns and switches between boards", async ({ page }) => {
  await boardsMenu(page, "New board");
  await page.getByLabel("Board name").fill("Launch");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(heading(page)).toHaveText("Launch");
  await expect(page.getByTestId("column")).toHaveCount(5);
  await expect(page.getByTestId("card")).toHaveCount(0);

  await page.reload(); // the URL hash keeps the open board
  await expect(heading(page)).toHaveText("Launch");

  await boardsMenu(page, "My first board");
  await expect(heading(page)).toHaveText("My first board");
  await expect(page.getByTestId("card")).toHaveCount(8);
});

test("renames the board from the menu or by clicking its name", async ({ page }) => {
  await boardsMenu(page, "Rename board");
  await expect(page.getByLabel("Board name")).toBeFocused();
  await page.getByLabel("Board name").fill("Roadmap");
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText("Roadmap");

  await page.getByRole("button", { name: "Roadmap" }).click();
  await page.getByLabel("Board name").fill("Roadmap 2027");
  await page.keyboard.press("Enter");
  await page.reload();
  await expect(heading(page)).toHaveText("Roadmap 2027");
});

test("deletes boards after confirming, down to the empty state", async ({ page }) => {
  await boardsMenu(page, "New board");
  await page.getByLabel("Board name").fill("Scratch");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(heading(page)).toHaveText("Scratch");

  await boardsMenu(page, "Delete board");
  const confirm = page.getByRole("alertdialog", { name: "Delete Scratch?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(heading(page)).toHaveText("Scratch");

  await boardsMenu(page, "Delete board");
  await confirm.getByRole("button", { name: "Delete board" }).click();
  await expect(heading(page)).toHaveText("My first board");

  await boardsMenu(page, "Delete board");
  await page.getByRole("button", { name: "Delete board" }).click();
  await expect(page.getByRole("heading", { name: "You have no boards yet" })).toBeVisible();
  await page.getByLabel("Board name").fill("Fresh start");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(heading(page)).toHaveText("Fresh start");
});
