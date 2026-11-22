"use client";

import { KeyRound, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { send, UNREACHABLE } from "@/lib/api";

type Props = { username: string; onSignedOut: () => void };

export function AccountMenu({ username, onSignedOut }: Props) {
  const [open, setOpen] = useState<"password" | "delete" | null>(null);
  const close = (isOpen: boolean) => !isOpen && setOpen(null);

  const logOut = async () => {
    await send("POST", "/api/logout");
    onSignedOut();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label={`Account ${username}`} className="gap-2 px-1.5">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground uppercase">
                {username[0]}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate sm:inline">{username}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{username}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen("password")}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen("delete")}>
            <Trash2 />
            Delete account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={logOut}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open === "password"} onOpenChange={close}>
        <DialogContent className="sm:max-w-sm">
          <PasswordForm onDone={() => setOpen(null)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={open === "delete"} onOpenChange={close}>
        <AlertDialogContent className="sm:max-w-sm">
          <DeleteForm onDeleted={onSignedOut} />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ErrorText({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null;
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await send("PUT", "/api/me/password", { current, new: next });
    if (res?.ok) {
      toast.success("Password changed");
      return onDone();
    }
    setError(
      !res
        ? UNREACHABLE
        : res.status === 403
          ? "That is not your current password. Try again."
          : "The new password needs at least 8 characters.",
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Change password</DialogTitle>
        <DialogDescription>You stay signed in here; other devices are signed out.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          aria-describedby="new-password-hint"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <p id="new-password-hint" className="text-xs text-muted-foreground">
          At least 8 characters.
        </p>
      </div>
      <ErrorText error={error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit">Change password</Button>
      </DialogFooter>
    </form>
  );
}

function DeleteForm({ onDeleted }: { onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await send("DELETE", "/api/me", { password });
    if (res?.ok) {
      toast.success("Account deleted");
      return onDeleted();
    }
    setError(!res ? UNREACHABLE : "That password is not right. Try again.");
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete your account?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently deletes your account and all your boards. It cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="delete-password">Enter your password to confirm</Label>
        <Input
          id="delete-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <ErrorText error={error} />
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button type="submit" variant="destructive">
          Delete account
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
