import { expect, test } from "@playwright/test";
import { column, drag, resetBoard, saved } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  await page.goto("/");
  await expect(page.getByTestId("card")).toHaveCount(8);
});

const titles = (page: import("@playwright/test").Page, name: string) => column(page, name).getByRole("heading", { level: 3 });

test("loads the demo board with progress", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My first board");
  await expect(page.getByTestId("column")).toHaveCount(5);
  await expect(page.getByText("2 of 8 done")).toBeVisible();
});

test("adds a card, which survives a reload", async ({ page }) => {
  const review = column(page, "Review");
  await review.getByRole("button", { name: "Add card" }).click();
  await saved(page, () => review.getByLabel("Card title").fill("Write release notes").then(() => page.keyboard.press("Enter")));
  await page.reload();
  await expect(titles(page, "Review")).toHaveText(["Accessibility audit", "Write release notes"]);
});

test("edits every card field, which survive a reload", async ({ page }) => {
  await page.getByText("Define product vision").hover();
  await page.getByRole("button", { name: "Edit Define product vision" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit card" });
  await dialog.getByLabel("Title").fill("Refined vision");
  await dialog.getByLabel("Details").fill("Updated summary");
  await dialog.getByRole("button", { name: "Due date: No due date" }).click();
  await page.getByRole("button", { name: /Today/ }).click();
  await dialog.getByRole("combobox", { name: "Priority" }).click();
  await page.getByRole("option", { name: "High" }).click();
  await dialog.getByLabel("Labels").fill("strategy, q1");
  await saved(page, () => dialog.getByRole("button", { name: "Save card" }).click());
  await page.reload();
  const card = page.getByTestId("card").filter({ hasText: "Refined vision" });
  await expect(card).toContainText("Updated summary");
  await expect(card).toContainText("Priority: High");
  await expect(card).toContainText("Due today");
  await expect(card).toContainText("strategy");
  await expect(card).toContainText("q1");
});

test("deletes a card", async ({ page }) => {
  await page.getByText("Competitor research").hover();
  await saved(page, () => page.getByRole("button", { name: "Delete Competitor research" }).click());
  await page.reload();
  await expect(page.getByTestId("card")).toHaveCount(7);
  await expect(page.getByText("Competitor research")).toHaveCount(0);
});

test("renames a column", async ({ page }) => {
  await page.getByRole("button", { name: "Backlog", exact: true }).click();
  await page.getByLabel("Column title").fill("Ideas");
  await saved(page, () => page.keyboard.press("Enter"));
  await page.reload();
  await expect(column(page, "Ideas")).toBeVisible();
});

test("adds a column and deletes columns, confirming when they hold cards", async ({ page }) => {
  await page.getByRole("button", { name: "Add column" }).click();
  await page.keyboard.type("Ideas");
  await saved(page, () => page.keyboard.press("Enter"));
  await expect(page.getByTestId("column").last()).toHaveAccessibleName("Ideas");

  await saved(page, () => page.getByRole("button", { name: "Delete column Ideas" }).click());
  await page.getByRole("button", { name: "Delete column Review" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete Review?" });
  await expect(confirm).toContainText("Its 1 card is deleted too.");
  await saved(page, () => confirm.getByRole("button", { name: "Delete column" }).click());
  await page.reload();
  await expect(page.getByTestId("column")).toHaveCount(4);
  await expect(page.getByTestId("card")).toHaveCount(7);
});

test("drags a card to another column", async ({ page }) => {
  await saved(page, () => drag(page, page.getByRole("button", { name: "Drag Define product vision" }), column(page, "In Progress").getByRole("heading", { level: 2 })));
  await page.reload();
  await expect(titles(page, "In Progress")).toContainText(["Define product vision"]);
  await expect(titles(page, "Backlog")).toHaveText(["Competitor research"]);
});

test("drags a card into an empty column", async ({ page }) => {
  await page.getByRole("button", { name: "Add column" }).click();
  await page.keyboard.type("Ideas");
  await saved(page, () => page.keyboard.press("Enter"));
  const ideas = column(page, "Ideas");
  await saved(page, () => drag(page, page.getByRole("button", { name: "Drag Accessibility audit" }), ideas.getByText("Drop cards here")));
  await page.reload();
  await expect(titles(page, "Ideas")).toHaveText(["Accessibility audit"]);
});

test("reorders cards within a column", async ({ page }) => {
  await saved(page, () => drag(page, page.getByRole("button", { name: "Drag Define product vision" }), page.getByText("Competitor research")));
  await page.reload();
  await expect(titles(page, "Backlog")).toHaveText(["Competitor research", "Define product vision"]);
});

test("moves a card with the keyboard from its grip", async ({ page }) => {
  await page.getByRole("button", { name: "Drag Define product vision" }).focus();
  await page.keyboard.press("Space");
  // dnd-kit attaches its key listeners just after pickup; Backlog has two cards, so repeating ArrowDown is harmless.
  await expect(async () => {
    await page.keyboard.press("ArrowDown");
    await expect(column(page, "Backlog").getByTestId("card").nth(1)).toHaveAttribute("style", /translate3d\(0px, -/, { timeout: 500 });
  }).toPass();
  await saved(page, () => page.keyboard.press("Space"));
  await expect(titles(page, "Backlog")).toHaveText(["Competitor research", "Define product vision"]);
});

test("reorders columns by dragging the grip", async ({ page }) => {
  await saved(page, () => drag(page, page.getByRole("button", { name: "Drag column Done" }), column(page, "Backlog").getByRole("heading", { level: 2 })));
  await page.reload();
  await expect(page.getByTestId("column").first()).toHaveAccessibleName("Done");
});

test("serves the board without errors", async ({ page }) => {
  const failures: string[] = [];
  page.on("response", (r) => r.status() >= 400 && failures.push(`${r.status()} ${r.url()}`));
  page.on("pageerror", (e) => failures.push(e.message));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("card")).toHaveCount(8);
  expect(failures).toEqual([]);
});
