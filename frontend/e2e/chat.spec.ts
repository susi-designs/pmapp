import { expect, test } from "@playwright/test";
import { column, resetBoard } from "./helpers";

// The AI is mocked at the network layer here; the backend's live tests call the real model.
let boardId: number;

test.beforeEach(async ({ page }) => {
  boardId = await resetBoard(page);
  await page.goto("/");
  await expect(page.getByTestId("card")).toHaveCount(8);
  await page.getByRole("button", { name: "Ask AI" }).click();
});

test("the reply shows and the board updates without a reload", async ({ page }) => {
  await page.route("**/api/boards/*/chat", async (route) => {
    const board = await (await page.request.get(`/api/boards/${boardId}`)).json();
    const id = "chat-card";
    board.cards[id] = { id, title: "Added by AI", details: "From chat", dueDate: null, priority: "high", labels: [] };
    board.columns[1].cardIds.push(id);
    await route.fulfill({ json: { message: "I added the card.", board } });
  });
  await page.getByLabel("Chat message").fill("add a card to To Do");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("chat-assistant")).toHaveText("I added the card.");
  await expect(column(page, "To Do").getByText("Added by AI")).toBeVisible();
});

test("the user message shows while waiting for the reply", async ({ page }) => {
  await page.route("**/api/boards/*/chat", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ json: { message: "Done", board: null } });
  });
  await page.getByLabel("Chat message").fill("slow question");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("chat-user")).toHaveText("slow question");
  await expect(page.getByText("Thinking...")).toBeVisible();
  await expect(page.getByTestId("chat-assistant")).toHaveText("Done");
});

test("shows an error when the AI fails", async ({ page }) => {
  await page.route("**/api/boards/*/chat", (route) => route.fulfill({ status: 502, json: { detail: "The AI request failed" } }));
  await page.getByLabel("Chat message").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("The AI request failed. Send your message again to retry.")).toBeVisible();
});

test("opens with focus in the message box and closes with Escape or the close button", async ({ page }) => {
  await expect(page.getByLabel("Chat message")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Chat message")).toBeHidden();
  await expect(page.getByRole("button", { name: "Ask AI" })).toBeFocused();
  await page.getByRole("button", { name: "Ask AI" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Chat message")).toBeHidden();
});

test("the board stays usable while the panel is open", async ({ page }) => {
  await page.getByText("Competitor research").hover();
  await page.getByRole("button", { name: "Delete Competitor research" }).click();
  await expect(page.getByTestId("card")).toHaveCount(7);
  await expect(page.getByLabel("Chat message")).toBeVisible();
});

test("works on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const panel = page.getByRole("dialog", { name: "AI assistant" });
  await expect(page.getByLabel("Chat message")).toBeVisible();
  // Measure after the slide-in animation, which starts 40px off to the right.
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const box = (await panel.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Chat message")).toBeHidden();
});
