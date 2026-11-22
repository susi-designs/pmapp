import type { Locator, Page } from "@playwright/test";

export async function signIn(page: Page, username = "user", password = "password") {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  // Wait for the reply: login hashes the password on purpose (slowly), and the session cookie arrives with it.
  await Promise.all([page.waitForResponse("**/api/login"), page.getByRole("button", { name: "Sign in" }).click()]);
}

export async function register(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await Promise.all([page.waitForResponse("**/api/register"), page.getByRole("button", { name: "Create account" }).click()]);
}

export async function openAccount(page: Page, item: string) {
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

export async function logOut(page: Page) {
  await openAccount(page, "Log out");
}

const DEMO: [string, [string, string][]][] = [
  ["Backlog", [
    ["Define product vision", "Draft a one-page summary of goals and target users."],
    ["Competitor research", "Review five similar tools and note strengths and gaps."],
  ]],
  ["To Do", [
    ["Design system tokens", "Colors, type scale and spacing for the new interface."],
    ["Onboarding flow", "Sketch the first-run experience in three steps."],
  ]],
  ["In Progress", [["Build settings page", "Profile, notifications and theme preferences."]]],
  ["Review", [["Accessibility audit", "Keyboard navigation and contrast checks across screens."]]],
  ["Done", [
    ["Set up CI pipeline", "Run lint, tests and build on every pull request."],
    ["Launch landing page", "Hero, feature highlights and sign-up call to action."],
  ]],
];

/**
 * The database persists between tests, so board tests start by signing in through the API and restoring the demo
 * user's workspace: one board, "My first board", with the demo columns and cards. Signs the page's browser in too.
 */
export async function resetBoard(page: Page) {
  const api = page.request;
  await api.post("/api/login", { data: { username: "user", password: "password" } });
  let boards: { id: number }[] = await (await api.get("/api/boards")).json();
  if (!boards.length) boards = [await (await api.post("/api/boards", { data: { name: "My first board" } })).json()];
  for (const extra of boards.slice(1)) await api.delete(`/api/boards/${extra.id}`);
  const id = boards[0].id;
  await api.patch(`/api/boards/${id}`, { data: { name: "My first board" } });
  const cards: Record<string, object> = {};
  const columns = DEMO.map(([title, items]) => {
    const cardIds = items.map(([cardTitle, details]) => {
      const cardId = crypto.randomUUID();
      cards[cardId] = { id: cardId, title: cardTitle, details, dueDate: null, priority: null, labels: [] };
      return cardId;
    });
    return { id: crypto.randomUUID(), title, cardIds };
  });
  await api.put(`/api/boards/${id}`, { data: { cards, columns } });
  return id;
}

export const column = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

/** Drag with the mouse from the middle of `source` to the middle of `target`. */
export async function drag(page: Page, source: Locator, target: Locator) {
  await source.waitFor();
  const s = (await source.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 10, { steps: 3 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 15 });
  await page.mouse.up();
}

/** Run an action and wait for the board save it triggers. */
export async function saved(page: Page, action: () => Promise<void>) {
  const done = page.waitForResponse((r) => /\/api\/boards\/\d+$/.test(r.url()) && r.request().method() === "PUT");
  await action();
  await done;
}
