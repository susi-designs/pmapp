"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CardDialog } from "@/components/CardDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dueStatus, formatDate, labelColor, today } from "@/lib/board";
import type { Card, CardFields } from "@/lib/types";
import { cn } from "@/lib/utils";

const tint = "border-transparent";
const PRIORITY = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-highlight/25 text-foreground",
  low: "bg-secondary text-secondary-foreground",
};
const DUE = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-highlight/25 text-foreground",
  upcoming: "",
};

function Chips({ card }: { card: Card }) {
  if (!card.priority && !card.dueDate && card.labels.length === 0) return null;
  const now = today();
  const status = card.dueDate && dueStatus(card.dueDate, now);
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {card.priority && (
        <Badge variant="outline" className={cn(tint, PRIORITY[card.priority])}>
          <span className="sr-only">Priority: </span>
          {card.priority[0].toUpperCase() + card.priority.slice(1)}
        </Badge>
      )}
      {card.dueDate && status && (
        <Badge variant="outline" className={cn(status !== "upcoming" && tint, DUE[status])}>
          {status === "today" ? "Due today" : `${status === "overdue" ? "Overdue" : "Due"} ${formatDate(card.dueDate, now)}`}
        </Badge>
      )}
      {card.labels.map((label) => (
        <Badge key={label} variant="outline" className={cn(tint, labelColor(label))}>
          {label}
        </Badge>
      ))}
    </div>
  );
}

/** The card's look; also used as the drag overlay. */
export function CardView({ card, overlay, handle, actions }: { card: Card; overlay?: boolean; handle?: ReactNode; actions?: ReactNode }) {
  return (
    <div
      className={cn(
        "group relative flex gap-1 rounded-lg border bg-card py-2 pr-3 pl-1 text-card-foreground shadow-xs",
        overlay ? "rotate-2 cursor-grabbing shadow-lg ring-2 ring-ring" : "hover:border-ring/60",
      )}
    >
      {handle ?? (
        <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground" aria-hidden>
          <GripVertical className="size-4" />
        </span>
      )}
      {/* Touch screens always show the Edit and Delete tray, so keep the text clear of it. */}
      <div className={cn("min-w-0 flex-1 pt-0.5", actions && "[@media(hover:none)]:pr-12")}>
        <h3 className="text-sm font-medium break-words">{card.title}</h3>
        {card.details && <p className="mt-1 line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">{card.details}</p>}
        <Chips card={card} />
      </div>
      {actions && (
        <div className="absolute top-1.5 right-1.5 flex rounded-md bg-card opacity-0 shadow-sm ring-1 ring-border group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}

export function SortableCard({ card, onDelete, onUpdate }: { card: Card; onDelete: () => void; onUpdate: (fields: CardFields) => void }) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
  });
  return (
    <div
      ref={setNodeRef}
      data-testid="card"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <CardView
        card={card}
        handle={
          // Only the grip starts a drag, so the buttons on the card are not nested inside another button.
          <Button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            variant="ghost"
            size="icon-xs"
            aria-label={`Drag ${card.title}`}
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical />
          </Button>
        }
        actions={
          <>
            <Button variant="ghost" size="icon-xs" aria-label={`Edit ${card.title}`} onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete ${card.title}`}
              onClick={onDelete}
              className="hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </>
        }
      />
      <CardDialog card={card} open={editing} onOpenChange={setEditing} onSave={onUpdate} />
    </div>
  );
}
