"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddCard } from "@/components/AddCard";
import { SortableCard } from "@/components/CardItem";
import { InlineEdit } from "@/components/InlineEdit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Card, CardFields, Column as ColumnType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  column: ColumnType;
  cards: Card[];
  canDelete: boolean;
  autoEdit: boolean;
  onRename: (title: string) => void;
  onDeleteColumn: () => void;
  onAdd: (title: string) => void;
  onDelete: (cardId: string) => void;
  onUpdate: (cardId: string, fields: Partial<CardFields>) => void;
};

export function Column({ column, cards, canDelete, autoEdit, onRename, onDeleteColumn, onAdd, onDelete, onUpdate }: Props) {
  // The column is both sortable (its grip reorders columns) and the drop target for cards.
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging, isOver, active } =
    useSortable({ id: column.id, data: { type: "column" } });
  const [editing, setEditing] = useState(autoEdit);
  const [confirming, setConfirming] = useState(false);
  const cardOver = isOver && active?.data.current?.type !== "column";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex min-h-0 min-w-[85vw] flex-1 snap-start sm:min-w-56", isDragging && "opacity-40")}
    >
      <section
        data-testid="column"
        aria-label={column.title}
        className={cn(
          "flex min-h-0 w-full flex-col rounded-xl border bg-muted/50 p-2 transition-colors",
          cardOver && "bg-accent ring-2 ring-ring",
        )}
      >
        <div className="group/head mb-2 flex items-center gap-1">
          <Button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            variant="ghost"
            size="icon-xs"
            aria-label={`Drag column ${column.title}`}
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical />
          </Button>
          {editing ? (
            <InlineEdit
              label="Column title"
              value={column.title}
              className="font-semibold"
              onSave={onRename}
              onDone={() => setEditing(false)}
            />
          ) : (
            <h2 className="min-w-0 flex-1 text-sm font-semibold">
              <button
                title="Rename column"
                onClick={() => setEditing(true)}
                className="block w-full cursor-text truncate rounded-md px-1 py-0.5 text-left hover:bg-background/60"
              >
                {column.title}
              </button>
            </h2>
          )}
          <Badge variant="secondary" className="tabular-nums">
            {cards.length}
          </Badge>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete column ${column.title}`}
              onClick={() => (cards.length ? setConfirming(true) : onDeleteColumn())}
              className="text-muted-foreground opacity-0 group-hover/head:opacity-100 hover:text-destructive focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Trash2 />
            </Button>
          )}
        </div>

        <div className="-mx-1 flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-1 py-0.5">
          <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
            {cards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                onDelete={() => onDelete(card.id)}
                onUpdate={(fields) => onUpdate(card.id, fields)}
              />
            ))}
          </SortableContext>
          {cards.length === 0 && (
            <p
              className={cn(
                "flex flex-1 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground",
                cardOver && "border-ring",
              )}
            >
              Drop cards here
            </p>
          )}
        </div>

        <AddCard onAdd={onAdd} />
      </section>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {column.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {cards.length} {cards.length === 1 ? "card is" : "cards are"} deleted too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDeleteColumn}>
              Delete column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
