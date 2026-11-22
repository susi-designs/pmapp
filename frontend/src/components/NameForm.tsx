"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A board name field with a submit button; `extra` goes next to it (for example a Cancel button). */
export function NameForm({ submit, onSubmit, extra }: { submit: string; onSubmit: (name: string) => void; extra?: ReactNode }) {
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="board-name">Board name</Label>
        <Input id="board-name" autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        {extra}
        <Button type="submit">{submit}</Button>
      </div>
    </form>
  );
}
