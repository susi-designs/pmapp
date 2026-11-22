"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  maxLength?: number;
  className?: string;
  /** Called with the trimmed text when it is not blank and has changed. */
  onSave: (value: string) => void;
  onDone: () => void;
};

/** A focused text field for renaming in place: Enter or leaving the field saves, Escape cancels. */
export function InlineEdit({ label, value, maxLength, className, onSave, onDone }: Props) {
  const [draft, setDraft] = useState(value);
  // Escape unmounts the field; a blur fired during that must not save.
  const cancelled = useRef(false);
  const save = () => {
    if (cancelled.current) return;
    const text = draft.trim();
    if (text && text !== value) onSave(text);
    onDone();
  };
  return (
    <Input
      autoFocus
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          onDone();
        }
      }}
      className={cn("h-7", className)}
    />
  );
}
