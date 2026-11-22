"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** "Add card" at the bottom of a column: opens a title field that stays open for the next card. */
export function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const close = () => {
    setOpen(false);
    setTitle("");
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} className="mt-2 w-full justify-start text-muted-foreground">
        <Plus />
        Add card
      </Button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim());
        setTitle("");
      }}
      className="mt-2 grid gap-2"
    >
      <Input
        autoFocus
        aria-label="Card title"
        placeholder="What needs doing?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Add card
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
