"use client";

import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { NameForm } from "@/components/NameForm";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineEdit } from "@/components/InlineEdit";
import type { BoardSummary } from "@/lib/types";

type Props = {
  boards: BoardSummary[];
  current: number;
  onSelect: (id: number) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

/** The board name (click to rename) and the "Boards" menu: switch, create, rename and delete boards. */
export function BoardSwitcher({ boards, current, onSelect, onCreate, onRename, onDelete }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [dialog, setDialog] = useState<"create" | "delete" | null>(null);
  // "Rename board" starts renaming only once the menu has closed: while it is open, its focus trap would pull focus
  // back from the name field, and on close it would move focus to its button.
  const renameOnClose = useRef(false);
  const name = boards.find((b) => b.id === current)!.name;

  return (
    <>
      {renaming ? (
        <InlineEdit
          label="Board name"
          value={name}
          maxLength={60}
          className="h-8 w-56 font-semibold"
          onSave={onRename}
          onDone={() => setRenaming(false)}
        />
      ) : (
        <h1 className="min-w-0 text-base font-semibold">
          <button
            title="Rename board"
            onClick={() => setRenaming(true)}
            className="block max-w-full cursor-text truncate rounded-md px-1.5 py-0.5 hover:bg-muted"
          >
            {name}
          </button>
        </h1>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Boards">
            <ChevronsUpDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-64"
          onCloseAutoFocus={(e) => {
            if (!renameOnClose.current) return;
            renameOnClose.current = false;
            e.preventDefault();
            setRenaming(true);
          }}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">Your boards</DropdownMenuLabel>
          <DropdownMenuGroup className="max-h-64 overflow-y-auto">
            {boards.map((b) => (
              <DropdownMenuItem key={b.id} aria-current={b.id === current ? "page" : undefined} onSelect={() => onSelect(b.id)}>
                <Check className={b.id === current ? "" : "invisible"} />
                <span className="truncate">{b.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("create")}>
            <Plus />
            New board
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              renameOnClose.current = true;
            }}
          >
            <Pencil />
            Rename board
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 />
            Delete board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "create"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>It starts with the default columns.</DialogDescription>
          </DialogHeader>
          <NameForm
            submit="Create board"
            onSubmit={(n) => {
              setDialog(null);
              onCreate(n);
            }}
            extra={
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            }
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>This deletes the board and all its cards. It cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
