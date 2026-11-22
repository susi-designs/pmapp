"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CardView } from "@/components/CardItem";
import { ChatSheet, useChat } from "@/components/Chat";
import { Column } from "@/components/Column";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { send } from "@/lib/api";
import {
  addCard,
  addColumn,
  deleteCard,
  deleteColumn,
  findColumnId,
  moveCard,
  moveColumn,
  newCard,
  renameColumn,
  updateCard,
} from "@/lib/board";
import type { Board as BoardType } from "@/lib/types";

type Props = {
  boardId: number;
  initial: BoardType;
  username: string;
  onSignedOut: () => void;
  title: ReactNode;
};

type DragEvent = { active: { data: { current?: Record<string, unknown> } } };
const isColumnDrag = (e: DragEvent) => e.active.data.current?.type === "column";

/** One board: its state, ordered saving, and drag and drop for cards and columns. */
export function Board({ boardId, initial, username, onSignedOut, title }: Props) {
  const [board, setBoard] = useState(initial);
  const [active, setActive] = useState<{ id: string; column: boolean } | null>(null);
  const [newColumnId, setNewColumnId] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());
  const chat = useChat(boardId, setBoard);

  // Saves run one after another so they reach the server in order.
  const save = (next: BoardType) => {
    queue.current = queue.current.then(async () => {
      const res = await send("PUT", `/api/boards/${boardId}`, next);
      if (!res?.ok) {
        toast.error("Could not save your changes. Reload the page to see the saved board.", { id: "save-failed" });
      }
    });
  };

  const commit = (next: BoardType) => {
    setBoard(next);
    save(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** The column with this id, or the column holding the card with this id. */
  const columnOf = (id: string | number) =>
    board.columns.find((c) => c.id === String(id)) ?? board.columns.find((c) => c.cardIds.includes(String(id)));
  const name = (id: string | number) => board.cards[String(id)]?.title ?? columnOf(id)?.title ?? "item";
  const where = (id: string | number) => columnOf(id)?.title ?? "the board";
  const announcements = {
    onDragStart: ({ active }: DragStartEvent) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }: DragOverEvent) =>
      over ? `${name(active.id)} is over ${where(over.id)}.` : `${name(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }: DragEndEvent) =>
      over ? `${name(active.id)} dropped in ${where(over.id)}.` : `${name(active.id)} dropped.`,
    onDragCancel: ({ active }: DragEndEvent) => `Moving ${name(active.id)} cancelled.`,
  };

  const onDragStart = (e: DragStartEvent) => setActive({ id: String(e.active.id), column: isColumnDrag(e) });

  // Move a card across columns while dragging so the target column makes room.
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || isColumnDrag(e)) return;
    const cardId = String(active.id);
    const overId = String(over.id);
    const overColumn = columnOf(overId);
    if (!overColumn || findColumnId(board, cardId) === overColumn.id) return;
    const index = overColumn.id === overId ? overColumn.cardIds.length : overColumn.cardIds.indexOf(overId);
    setBoard(moveCard(board, cardId, overColumn.id, index));
  };

  // Cards may already have changed column during drag-over, so a card drag always saves the final board.
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActive(null);
    if (isColumnDrag(e)) {
      const target = over && columnOf(over.id);
      if (target && target.id !== active.id) commit(moveColumn(board, String(active.id), board.columns.indexOf(target)));
      return;
    }
    let next = board;
    if (over && active.id !== over.id) {
      const column = board.columns.find((c) => c.cardIds.includes(String(over.id)));
      if (column && column.cardIds.includes(String(active.id))) {
        next = moveCard(board, String(active.id), column.id, column.cardIds.indexOf(String(over.id)));
      }
    }
    commit(next);
  };

  const onDragCancel = (e: DragEndEvent) => {
    setActive(null);
    if (!isColumnDrag(e)) save(board);
  };

  const newColumn = () => {
    const id = crypto.randomUUID();
    commit(addColumn(board, id, "New column"));
    setNewColumnId(id);
  };

  const total = Object.keys(board.cards).length;
  const done = board.columns.at(-1)?.cardIds.length ?? 0;
  const dragged = active && (active.column ? columnOf(active.id) : board.cards[active.id]);

  return (
    <AppShell
      username={username}
      onSignedOut={onSignedOut}
      title={title}
      actions={
        <>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span>
              {done} of {total} done
            </span>
            <Progress value={total ? (done / total) * 100 : 0} className="w-20" aria-hidden />
          </div>
          <ChatSheet chat={chat} />
        </>
      }
    >
      <DndContext
        id="board"
        accessibility={{ announcements }}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex min-h-0 flex-1 snap-x snap-proximity scroll-px-4 gap-3 overflow-x-auto p-4">
          <SortableContext items={board.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {board.columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                cards={column.cardIds.map((id) => board.cards[id])}
                canDelete={board.columns.length > 1}
                autoEdit={column.id === newColumnId}
                onRename={(text) => commit(renameColumn(board, column.id, text))}
                onDeleteColumn={() => commit(deleteColumn(board, column.id))}
                onAdd={(text) => commit(addCard(board, column.id, newCard(text)))}
                onDelete={(cardId) => commit(deleteCard(board, cardId))}
                onUpdate={(cardId, fields) => commit(updateCard(board, cardId, fields))}
              />
            ))}
          </SortableContext>
          <Button variant="outline" onClick={newColumn} className="w-36 shrink-0 snap-start border-dashed">
            <Plus />
            Add column
          </Button>
        </div>
        <DragOverlay>
          {dragged && "cardIds" in dragged ? (
            <div className="w-64 rotate-2 rounded-xl border border-t-4 border-t-highlight bg-card p-3 shadow-xl">
              <p className="text-sm font-semibold">{dragged.title}</p>
              <p className="text-xs text-muted-foreground">{dragged.cardIds.length} cards</p>
            </div>
          ) : dragged ? (
            <CardView card={dragged} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </AppShell>
  );
}
