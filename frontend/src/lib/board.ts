import type { Board, Card, CardFields } from "./types";

export function findColumnId(board: Board, cardId: string) {
  return board.columns.find((c) => c.cardIds.includes(cardId))?.id;
}

/** Move a card to `toIndex` of the target column (works within and across columns). */
export function moveCard(board: Board, cardId: string, toColumnId: string, toIndex: number): Board {
  const columns = board.columns.map((c) => ({ ...c, cardIds: c.cardIds.filter((id) => id !== cardId) }));
  const target = columns.find((c) => c.id === toColumnId)!;
  target.cardIds.splice(toIndex, 0, cardId);
  return { ...board, columns };
}

export function newCard(title: string, details = ""): Card {
  return { id: crypto.randomUUID(), title, details, dueDate: null, priority: null, labels: [] };
}

export function addCard(board: Board, columnId: string, card: Card): Board {
  return {
    cards: { ...board.cards, [card.id]: card },
    columns: board.columns.map((c) => (c.id === columnId ? { ...c, cardIds: [...c.cardIds, card.id] } : c)),
  };
}

export function deleteCard(board: Board, cardId: string): Board {
  const cards = { ...board.cards };
  delete cards[cardId];
  return {
    cards,
    columns: board.columns.map((c) => ({ ...c, cardIds: c.cardIds.filter((id) => id !== cardId) })),
  };
}

export function updateCard(board: Board, cardId: string, fields: Partial<CardFields>): Board {
  return { ...board, cards: { ...board.cards, [cardId]: { ...board.cards[cardId], ...fields } } };
}

export function renameColumn(board: Board, columnId: string, title: string): Board {
  return { ...board, columns: board.columns.map((c) => (c.id === columnId ? { ...c, title } : c)) };
}

export function addColumn(board: Board, id: string, title: string): Board {
  return { ...board, columns: [...board.columns, { id, title, cardIds: [] }] };
}

/** Remove a column and every card in it. */
export function deleteColumn(board: Board, columnId: string): Board {
  const removed = board.columns.find((c) => c.id === columnId)!;
  const cards = { ...board.cards };
  for (const id of removed.cardIds) delete cards[id];
  return { cards, columns: board.columns.filter((c) => c.id !== columnId) };
}

export function moveColumn(board: Board, columnId: string, toIndex: number): Board {
  const columns = board.columns.filter((c) => c.id !== columnId);
  columns.splice(toIndex, 0, board.columns.find((c) => c.id === columnId)!);
  return { ...board, columns };
}

/** Comma-separated text to labels: trimmed, no blanks or duplicates, at most 8 of up to 24 characters. */
export function parseLabels(text: string): string[] {
  const labels = text.split(",").map((l) => l.trim().slice(0, 24)).filter(Boolean);
  return [...new Set(labels)].slice(0, 8);
}

/** Today's date in the user's time zone as YYYY-MM-DD, the format due dates use. */
export function today(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dueStatus(dueDate: string, todayDate: string): "overdue" | "today" | "upcoming" {
  if (dueDate < todayDate) return "overdue";
  return dueDate === todayDate ? "today" : "upcoming";
}

/** "Dec 24", or "Dec 24, 2027" outside the current year. */
export function formatDate(date: string, todayDate: string) {
  const [year, month, day] = date.split("-").map(Number);
  const sameYear = date.slice(0, 4) === todayDate.slice(0, 4);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// Tinted chips built from theme tokens, so they work in light and dark.
const LABEL_COLORS = [
  "bg-ring/15 text-foreground",
  "bg-primary/15 text-foreground",
  "bg-highlight/25 text-foreground",
  "bg-foreground/10 text-foreground",
];

/** A stable colour for a label, so the same label looks the same everywhere. */
export function labelColor(label: string) {
  let hash = 0;
  for (const ch of label.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}
