import type { Board } from "@/lib/types";

const card = (id: string, title: string, fields = {}) => ({
  id,
  title,
  details: "",
  dueDate: null,
  priority: null,
  labels: [],
  ...fields,
});

/** A small board for unit tests: three columns, three cards. */
export function demoBoard(): Board {
  return {
    columns: [
      { id: "todo", title: "To Do", cardIds: ["a", "b"] },
      { id: "doing", title: "Doing", cardIds: [] },
      { id: "done", title: "Done", cardIds: ["c"] },
    ],
    cards: {
      a: card("a", "Write spec", { details: "One page" }),
      b: card("b", "Review spec"),
      c: card("c", "Kick-off"),
    },
  };
}
