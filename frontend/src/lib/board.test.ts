import { describe, expect, test } from "vitest";
import {
  addCard,
  addColumn,
  deleteCard,
  deleteColumn,
  dueStatus,
  findColumnId,
  formatDate,
  moveCard,
  moveColumn,
  newCard,
  parseLabels,
  renameColumn,
  today,
  updateCard,
} from "@/lib/board";
import { demoBoard } from "@/test/demoBoard";

const ids = (board: ReturnType<typeof demoBoard>) => board.columns.map((c) => c.cardIds);

describe("cards", () => {
  test("findColumnId", () => {
    expect(findColumnId(demoBoard(), "c")).toBe("done");
    expect(findColumnId(demoBoard(), "ghost")).toBeUndefined();
  });

  test("moveCard within and across columns, without changing the input", () => {
    const board = demoBoard();
    expect(ids(moveCard(board, "a", "todo", 1))).toEqual([["b", "a"], [], ["c"]]);
    expect(ids(moveCard(board, "a", "doing", 0))).toEqual([["b"], ["a"], ["c"]]);
    expect(ids(moveCard(board, "b", "done", 0))).toEqual([["a"], [], ["b", "c"]]);
    expect(ids(board)).toEqual(ids(demoBoard()));
  });

  test("newCard has a fresh id and empty fields", () => {
    const card = newCard("Title");
    expect(card).toMatchObject({ title: "Title", details: "", dueDate: null, priority: null, labels: [] });
    expect(newCard("Other").id).not.toBe(card.id);
  });

  test("addCard, updateCard and deleteCard", () => {
    const card = newCard("New");
    const added = addCard(demoBoard(), "doing", card);
    expect(added.columns[1].cardIds).toEqual([card.id]);
    expect(updateCard(added, card.id, { priority: "high" }).cards[card.id]).toMatchObject({ title: "New", priority: "high" });
    const deleted = deleteCard(added, "a");
    expect(deleted.cards.a).toBeUndefined();
    expect(ids(deleted)).toEqual([["b"], [card.id], ["c"]]);
  });
});

describe("columns", () => {
  test("rename, add and move", () => {
    expect(renameColumn(demoBoard(), "doing", "In progress").columns[1].title).toBe("In progress");
    const added = addColumn(demoBoard(), "new", "Ideas");
    expect(added.columns.at(-1)).toEqual({ id: "new", title: "Ideas", cardIds: [] });
    expect(moveColumn(added, "new", 0).columns.map((c) => c.id)).toEqual(["new", "todo", "doing", "done"]);
  });

  test("deleteColumn removes its cards", () => {
    const board = deleteColumn(demoBoard(), "todo");
    expect(board.columns.map((c) => c.id)).toEqual(["doing", "done"]);
    expect(Object.keys(board.cards)).toEqual(["c"]);
  });
});

describe("labels and dates", () => {
  test("parseLabels trims, drops blanks and duplicates, and limits count and length", () => {
    expect(parseLabels(" ux, design,,ux ,  ")).toEqual(["ux", "design"]);
    expect(parseLabels("x".repeat(30))).toEqual(["x".repeat(24)]);
    expect(parseLabels("1,2,3,4,5,6,7,8,9,10")).toHaveLength(8);
  });

  test("today uses the local date", () => {
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  test("dueStatus", () => {
    expect(dueStatus("2026-03-01", "2026-03-02")).toBe("overdue");
    expect(dueStatus("2026-03-02", "2026-03-02")).toBe("today");
    expect(dueStatus("2026-03-03", "2026-03-02")).toBe("upcoming");
  });

  test("formatDate shows the year only outside the current one", () => {
    expect(formatDate("2026-12-24", "2026-03-02")).toBe("Dec 24");
    expect(formatDate("2027-01-02", "2026-03-02")).toBe("Jan 2, 2027");
  });
});
