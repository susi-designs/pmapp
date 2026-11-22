"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, parseLabels, today } from "@/lib/board";
import type { Card, CardFields, Priority } from "@/lib/types";

type Props = { card: Card; open: boolean; onOpenChange: (open: boolean) => void; onSave: (fields: CardFields) => void };

/** Edit a card's title, details, due date, priority and labels. */
export function CardDialog({ card, open, onOpenChange, onSave }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <CardForm
          card={card}
          onSave={(fields) => {
            onSave(fields);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

const toDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// The dialog content mounts on open, so the fields start from the card each time.
function CardForm({ card, onSave }: { card: Card; onSave: (fields: CardFields) => void }) {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [dueDate, setDueDate] = useState(card.dueDate);
  const [priority, setPriority] = useState(card.priority);
  const [labels, setLabels] = useState(card.labels.join(", "));
  const [picking, setPicking] = useState(false);
  const dueText = dueDate ? formatDate(dueDate, today()) : "No due date";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave({ title: title.trim(), details: details.trim(), dueDate, priority, labels: parseLabels(labels) });
      }}
      className="grid gap-4"
    >
      <DialogHeader>
        <DialogTitle>Edit card</DialogTitle>
        <DialogDescription className="sr-only">Change the card title, details, due date, priority and labels.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="card-title">Title</Label>
        <Input id="card-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="card-details">Details</Label>
        <Textarea id="card-details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <span className="text-sm leading-none font-medium">Due date</span>
          <div className="flex gap-1">
            <Popover open={picking} onOpenChange={setPicking}>
              <PopoverTrigger asChild>
                <Button variant="outline" aria-label={`Due date: ${dueText}`} className="min-w-0 flex-1 justify-start font-normal">
                  <CalendarIcon />
                  <span className="truncate">{dueText}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate ? toDate(dueDate) : undefined}
                  defaultMonth={dueDate ? toDate(dueDate) : undefined}
                  onSelect={(date) => {
                    setDueDate(date ? today(date) : null);
                    setPicking(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          {dueDate && (
            <Button type="button" variant="link" size="xs" className="h-auto justify-self-start p-0" onClick={() => setDueDate(null)}>
              Clear due date
            </Button>
          )}
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="card-priority">Priority</Label>
          <Select value={priority ?? "none"} onValueChange={(v) => setPriority(v === "none" ? null : (v as Priority))}>
            <SelectTrigger id="card-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="card-labels">Labels</Label>
        <Input id="card-labels" aria-describedby="card-labels-hint" value={labels} onChange={(e) => setLabels(e.target.value)} />
        <p id="card-labels-hint" className="text-xs text-muted-foreground">
          Separate with commas. Up to 8, each up to 24 characters.
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit">Save card</Button>
      </DialogFooter>
    </form>
  );
}
