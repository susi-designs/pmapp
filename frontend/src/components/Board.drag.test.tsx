import type { DndContextProps } from "@dnd-kit/core";
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { App } from "@/components/App";
import { fakeServer } from "@/test/fakeServer";
import { renderWithProviders } from "@/test/render";

// jsdom cannot drag with a pointer, so the tests call the handlers Board passes to DndContext (the Playwright
// tests drag for real).
let dnd: DndContextProps;
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd = props;
      return <actual.DndContext {...props} />;
    },
  };
});

beforeEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

type Ev = Parameters<NonNullable<DndContextProps["onDragEnd"]>>[0];
const item = (id: string, type: "card" | "column") => ({ id, data: { current: { type } } });
const ev = (active: string, over: string | null, type: "card" | "column" = "card") =>
  ({ active: item(active, type), over: over ? { id: over } : null }) as unknown as Ev;

async function openBoard() {
  const server = fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  await screen.findAllByTestId("column");
  return server;
}

const cardTitles = (column: string) =>
  within(screen.getByRole("region", { name: column }))
    .queryAllByTestId("card")
    .map((c) => c.querySelector("h3")!.textContent);
const saved = (server: ReturnType<typeof fakeServer>) => server.boards[0].board;

test("moves a card to another column while dragging and saves once on drop", async () => {
  const server = await openBoard();
  act(() => dnd.onDragStart!(ev("a", null)));
  act(() => dnd.onDragOver!(ev("a", "doing")));
  expect(cardTitles("Doing")).toEqual(["Write spec"]);
  act(() => dnd.onDragOver!(ev("a", "doing"))); // already there: no change
  expect(server.puts).toBe(0);
  act(() => dnd.onDragEnd!(ev("a", "doing")));
  await waitFor(() => expect(saved(server).columns[1].cardIds).toEqual(["a"]));
  expect(server.puts).toBe(1);
});

test("drops a card before a card in another column", async () => {
  const server = await openBoard();
  act(() => dnd.onDragOver!(ev("b", "c")));
  // Drag-over already placed it before Kick-off, so dnd-kit reports the drop over the card itself.
  act(() => dnd.onDragEnd!(ev("b", "b")));
  expect(cardTitles("Done")).toEqual(["Review spec", "Kick-off"]);
  await waitFor(() => expect(saved(server).columns[2].cardIds).toEqual(["b", "c"]));
});

test("reorders cards within a column", async () => {
  const server = await openBoard();
  act(() => dnd.onDragEnd!(ev("a", "b")));
  expect(cardTitles("To Do")).toEqual(["Review spec", "Write spec"]);
  await waitFor(() => expect(saved(server).columns[0].cardIds).toEqual(["b", "a"]));
});

test("ignores drags that end nowhere or over nothing new", async () => {
  const server = await openBoard();
  act(() => dnd.onDragOver!(ev("a", null)));
  act(() => dnd.onDragOver!(ev("a", "ghost")));
  act(() => dnd.onDragEnd!(ev("a", null)));
  act(() => dnd.onDragEnd!(ev("a", "a")));
  expect(cardTitles("To Do")).toEqual(["Write spec", "Review spec"]);
  await waitFor(() => expect(server.puts).toBe(2)); // a card drag always saves the final board
});

test("a cancelled card drag saves the board, a cancelled column drag does not", async () => {
  const server = await openBoard();
  act(() => dnd.onDragCancel!(ev("todo", null, "column")));
  act(() => dnd.onDragCancel!(ev("a", null)));
  await waitFor(() => expect(server.puts).toBe(1));
});

test("reorders columns on drop, over a column or a card in it", async () => {
  const server = await openBoard();
  act(() => dnd.onDragStart!(ev("done", null, "column")));
  act(() => dnd.onDragOver!(ev("done", "todo", "column"))); // columns move only on drop
  act(() => dnd.onDragEnd!(ev("done", "todo", "column")));
  const titles = () => screen.getAllByTestId("column").map((c) => c.getAttribute("aria-label"));
  expect(titles()).toEqual(["Done", "To Do", "Doing"]);
  act(() => dnd.onDragEnd!(ev("done", "b", "column")));
  expect(titles()).toEqual(["To Do", "Done", "Doing"]);
  await waitFor(() => expect(saved(server).columns.map((c) => c.id)).toEqual(["todo", "done", "doing"]));
});

test("a column dropped on itself or nowhere is not saved", async () => {
  const server = await openBoard();
  act(() => dnd.onDragEnd!(ev("todo", "todo", "column")));
  act(() => dnd.onDragEnd!(ev("todo", null, "column")));
  act(() => dnd.onDragEnd!(ev("todo", "ghost", "column")));
  await new Promise((r) => setTimeout(r, 20));
  expect(server.puts).toBe(0);
});

test("announces drags to screen readers with card and column names", async () => {
  await openBoard();
  const say = dnd.accessibility!.announcements!;
  expect(say.onDragStart({ active: item("a", "card") } as never)).toBe("Picked up Write spec.");
  expect(say.onDragOver(ev("a", "doing") as never)).toBe("Write spec is over Doing.");
  expect(say.onDragOver(ev("a", "c") as never)).toBe("Write spec is over Done.");
  expect(say.onDragOver(ev("a", null) as never)).toBe("Write spec is not over a column.");
  expect(say.onDragEnd(ev("todo", "done", "column") as never)).toBe("To Do dropped in Done.");
  expect(say.onDragEnd(ev("a", null) as never)).toBe("Write spec dropped.");
  expect(say.onDragEnd(ev("a", "ghost") as never)).toBe("Write spec dropped in the board.");
  expect(say.onDragCancel(ev("ghost", null) as never)).toBe("Moving item cancelled.");
});
