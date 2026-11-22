import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "@/components/App";
import { demoBoard } from "@/test/demoBoard";
import { fakeServer } from "@/test/fakeServer";
import { renderWithProviders } from "@/test/render";

const user = userEvent.setup();

beforeEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
  // Only Date is faked, so user-event's timers still run. Today is March 10, 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 2, 10, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

async function openApp(options?: Parameters<typeof fakeServer>[0]) {
  const server = fakeServer({ signedIn: "user", ...options });
  renderWithProviders(<App />);
  await screen.findAllByTestId("column");
  return server;
}

const column = (title: string) => screen.getByRole("region", { name: title });
const saved = (server: ReturnType<typeof fakeServer>, id = 1) => server.boards.find((b) => b.id === id)!.board;

async function boardsMenu(item: string) {
  await user.click(screen.getByRole("button", { name: "Boards" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

test("loads the first board and shows progress", async () => {
  await openApp();
  expect(screen.getByRole("heading", { level: 1, name: "Roadmap" })).toBeInTheDocument();
  expect(screen.getAllByTestId("column")).toHaveLength(3);
  expect(within(column("To Do")).getAllByTestId("card")).toHaveLength(2);
  expect(screen.getByText("One page")).toBeInTheDocument();
  expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
  expect(location.hash).toBe("#board-1");
});

test("opens the board named in the URL hash", async () => {
  history.replaceState(null, "", "#board-2");
  await openApp({
    boards: [
      { id: 1, name: "Roadmap", board: demoBoard() },
      { id: 2, name: "Launch", board: demoBoard() },
    ],
  });
  expect(screen.getByRole("heading", { level: 1, name: "Launch" })).toBeInTheDocument();
});

test("adds cards, keeping the field open for the next one", async () => {
  const server = await openApp();
  await user.click(within(column("Doing")).getByRole("button", { name: "Add card" }));
  await user.type(screen.getByLabelText("Card title"), "First{Enter}");
  await user.type(screen.getByLabelText("Card title"), "Second{Enter}");
  await user.type(screen.getByLabelText("Card title"), "   {Enter}");
  expect(within(column("Doing")).getAllByTestId("card")).toHaveLength(2);
  await waitFor(() => expect(saved(server).columns[1].cardIds).toHaveLength(2));
  await user.keyboard("{Escape}");
  expect(screen.queryByLabelText("Card title")).not.toBeInTheDocument();
  await user.click(within(column("Doing")).getByRole("button", { name: "Add card" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByLabelText("Card title")).not.toBeInTheDocument();
});

test("edits every card field", async () => {
  const server = await openApp();
  await user.click(screen.getByRole("button", { name: "Edit Write spec" }));
  const dialog = await screen.findByRole("dialog", { name: "Edit card" });
  await user.clear(within(dialog).getByLabelText("Title"));
  await user.type(within(dialog).getByLabelText("Title"), "Write the spec");
  await user.clear(within(dialog).getByLabelText("Details"));
  await user.type(within(dialog).getByLabelText("Details"), "Two pages");
  await user.click(within(dialog).getByRole("button", { name: "Due date: No due date" }));
  await user.click(await screen.findByRole("button", { name: /March 9th, 2026/ }));
  await user.click(within(dialog).getByRole("combobox", { name: "Priority" }));
  await user.click(await screen.findByRole("option", { name: "High" }));
  await user.type(within(dialog).getByLabelText("Labels"), "ux, design, ux");
  await user.click(within(dialog).getByRole("button", { name: "Save card" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const card = within(column("To Do")).getAllByTestId("card")[0];
  expect(within(card).getByText("Write the spec")).toBeInTheDocument();
  expect(within(card).getByText("Two pages")).toBeInTheDocument();
  expect(card).toHaveTextContent("Priority: High");
  expect(within(card).getByText("Overdue Mar 9")).toBeInTheDocument();
  expect(within(card).getByText("ux")).toBeInTheDocument();
  expect(within(card).getByText("design")).toBeInTheDocument();
  await waitFor(() =>
    expect(saved(server).cards.a).toEqual({
      id: "a",
      title: "Write the spec",
      details: "Two pages",
      dueDate: "2026-03-09",
      priority: "high",
      labels: ["ux", "design"],
    }),
  );
});

test("shows due today and upcoming dates, and clears a due date", async () => {
  const board = demoBoard();
  board.cards.a.dueDate = "2026-03-10";
  board.cards.b.dueDate = "2027-01-02";
  board.cards.c.priority = "low";
  await openApp({ boards: [{ id: 1, name: "Roadmap", board }] });
  expect(screen.getByText("Due today")).toBeInTheDocument();
  expect(screen.getByText("Due Jan 2, 2027")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Edit Write spec" }));
  await user.click(await screen.findByRole("button", { name: "Clear due date" }));
  expect(screen.getByRole("button", { name: "Due date: No due date" })).toBeInTheDocument();
  await user.click(screen.getByRole("combobox", { name: "Priority" }));
  await user.click(await screen.findByRole("option", { name: "None" }));
  await user.click(screen.getByRole("button", { name: "Save card" }));
  expect(screen.queryByText("Due today")).not.toBeInTheDocument();
});

test("cancelling the card dialog or leaving the title blank changes nothing", async () => {
  const server = await openApp();
  await user.click(screen.getByRole("button", { name: "Edit Write spec" }));
  await user.clear(await screen.findByLabelText("Title"));
  await user.type(screen.getByLabelText("Title"), "  ");
  await user.click(screen.getByRole("button", { name: "Save card" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByText("Write spec")).toBeInTheDocument();
  expect(server.puts).toBe(0);
});

test("deletes a card", async () => {
  const server = await openApp();
  await user.click(screen.getByRole("button", { name: "Delete Review spec" }));
  expect(screen.queryByText("Review spec")).not.toBeInTheDocument();
  await waitFor(() => expect(saved(server).cards.b).toBeUndefined());
});

test("renames a column in place; Escape cancels", async () => {
  const server = await openApp();
  await user.click(screen.getByRole("button", { name: "Doing" }));
  await user.clear(screen.getByLabelText("Column title"));
  await user.type(screen.getByLabelText("Column title"), "In progress{Enter}");
  expect(screen.getByRole("region", { name: "In progress" })).toBeInTheDocument();
  await waitFor(() => expect(saved(server).columns[1].title).toBe("In progress"));

  await user.click(screen.getByRole("button", { name: "In progress" }));
  await user.type(screen.getByLabelText("Column title"), " later{Escape}");
  expect(screen.getByRole("region", { name: "In progress" })).toBeInTheDocument();
  expect(server.puts).toBe(1);
});

test("adds a column and opens its title for editing", async () => {
  const server = await openApp();
  await user.click(screen.getByRole("button", { name: "Add column" }));
  const field = screen.getByLabelText("Column title");
  expect(field).toHaveFocus();
  await user.keyboard("Ideas{Enter}"); // the field opens with its text selected
  expect(screen.getAllByTestId("column").at(-1)).toHaveAccessibleName("Ideas");
  await waitFor(() => expect(saved(server).columns.at(-1)!.title).toBe("Ideas"));
});

test("deletes columns, asking first when they hold cards", async () => {
  const server = await openApp();
  await user.click(screen.getByRole("button", { name: "Delete column Doing" }));
  expect(screen.queryByRole("region", { name: "Doing" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Delete column To Do" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Delete To Do?" });
  expect(confirm).toHaveTextContent("Its 2 cards are deleted too.");
  await user.click(within(confirm).getByRole("button", { name: "Delete column" }));
  expect(screen.queryByRole("region", { name: "To Do" })).not.toBeInTheDocument();
  await waitFor(() => expect(saved(server).columns.map((c) => c.title)).toEqual(["Done"]));
  expect(Object.keys(saved(server).cards)).toEqual(["c"]);
  // The last column cannot be deleted.
  expect(screen.queryByRole("button", { name: "Delete column Done" })).not.toBeInTheDocument();
});

test("creates, switches, renames and deletes boards", async () => {
  const server = await openApp();
  await boardsMenu("New board");
  await user.type(await screen.findByLabelText("Board name"), "Launch{Enter}");
  expect(await screen.findByRole("heading", { level: 1, name: "Launch" })).toBeInTheDocument();
  expect(location.hash).toBe("#board-2");

  await boardsMenu("Roadmap");
  expect(await screen.findByRole("heading", { level: 1, name: "Roadmap" })).toBeInTheDocument();

  await boardsMenu("Rename board");
  const field = screen.getByLabelText("Board name");
  await waitFor(() => expect(field).toHaveFocus());
  await user.clear(field);
  await user.type(field, "Roadmap 2027{Enter}");
  expect(screen.getByRole("heading", { level: 1, name: "Roadmap 2027" })).toBeInTheDocument();
  await waitFor(() => expect(server.boards[0].name).toBe("Roadmap 2027"));

  await user.click(screen.getByRole("button", { name: "Roadmap 2027" }));
  await user.type(screen.getByLabelText("Board name"), " Q1{Escape}");
  expect(screen.getByRole("heading", { level: 1, name: "Roadmap 2027" })).toBeInTheDocument();

  await boardsMenu("Delete board");
  const confirm = await screen.findByRole("alertdialog", { name: "Delete Roadmap 2027?" });
  await user.click(within(confirm).getByRole("button", { name: "Delete board" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Launch" })).toBeInTheDocument();
  expect(await screen.findByText("Board deleted")).toBeInTheDocument();
  expect(server.boards.map((b) => b.name)).toEqual(["Launch"]);
});

test("cancelling the new board dialog creates nothing", async () => {
  const server = await openApp();
  await boardsMenu("New board");
  await user.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(server.boards).toHaveLength(1);
});

test("deleting the last board shows the empty state, which creates a board", async () => {
  const server = await openApp();
  await boardsMenu("Delete board");
  await user.click(await screen.findByRole("button", { name: "Delete board" }));
  expect(await screen.findByRole("heading", { name: "You have no boards yet" })).toBeInTheDocument();
  expect(location.hash).toBe("");
  await user.type(screen.getByLabelText("Board name"), "Fresh start{Enter}");
  expect(await screen.findByRole("heading", { level: 1, name: "Fresh start" })).toBeInTheDocument();
  expect(server.boards.map((b) => b.name)).toEqual(["Fresh start"]);
});

test("tells the user when a save fails", async () => {
  const server = await openApp();
  server.failSaves = true;
  await user.click(screen.getByRole("button", { name: "Delete Review spec" }));
  expect(await screen.findByText("Could not save your changes. Reload the page to see the saved board.")).toBeInTheDocument();
});

test("tells the user when boards cannot be loaded or changed", async () => {
  const server = fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  await screen.findByRole("heading", { level: 1, name: "Roadmap" });
  server.down = true;
  await boardsMenu("Rename board");
  await user.type(screen.getByLabelText("Board name"), " v2{Enter}");
  expect(await screen.findByText("Something went wrong. Reload the page and try again.")).toBeInTheDocument();
});
