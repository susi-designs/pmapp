export type Priority = "low" | "medium" | "high";
export type Card = {
  id: string;
  title: string;
  details: string;
  dueDate: string | null; // YYYY-MM-DD
  priority: Priority | null;
  labels: string[];
};
export type CardFields = Omit<Card, "id">;
export type Column = { id: string; title: string; cardIds: string[] };
export type Board = { cards: Record<string, Card>; columns: Column[] };
export type BoardSummary = { id: number; name: string };
