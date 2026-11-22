"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Board } from "@/components/Board";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { NameForm } from "@/components/NameForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { send } from "@/lib/api";
import type { Board as BoardType, BoardSummary } from "@/lib/types";

const failed = () => toast.error("Something went wrong. Reload the page and try again.", { id: "workspace-error" });

/** Loads the user's boards, keeps the open one in the URL hash, and creates, renames and deletes boards. */
export function Workspace({ username, onSignedOut }: { username: string; onSignedOut: () => void }) {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [current, setCurrent] = useState<{ id: number; board: BoardType } | null>(null);

  const open = async (id: number) => {
    const res = await send("GET", `/api/boards/${id}`);
    if (!res?.ok) return failed();
    setCurrent({ id, board: await res.json() });
    history.replaceState(null, "", `#board-${id}`);
  };

  useEffect(() => {
    send("GET", "/api/boards").then(async (res) => {
      if (!res?.ok) return failed();
      const list: BoardSummary[] = await res.json();
      setBoards(list);
      const fromHash = Number(location.hash.match(/^#board-(\d+)$/)?.[1]);
      const pick = list.find((b) => b.id === fromHash) ?? list[0];
      if (pick) open(pick.id);
    });
  }, []);

  const create = async (name: string) => {
    const res = await send("POST", "/api/boards", { name });
    if (!res?.ok) return failed();
    const created: BoardSummary = await res.json();
    setBoards((list) => [...list!, created]);
    await open(created.id);
  };

  const rename = async (id: number, name: string) => {
    const res = await send("PATCH", `/api/boards/${id}`, { name });
    if (!res?.ok) return failed();
    setBoards((list) => list!.map((b) => (b.id === id ? { ...b, name } : b)));
  };

  const remove = async (id: number) => {
    const res = await send("DELETE", `/api/boards/${id}`);
    if (!res?.ok) return failed();
    const rest = boards!.filter((b) => b.id !== id);
    setBoards(rest);
    toast.success("Board deleted");
    if (rest.length) return open(rest[0].id);
    setCurrent(null);
    history.replaceState(null, "", location.pathname);
  };

  // After the open board is deleted, `current` briefly points at a board no longer in the list until the next opens.
  const summary = current && boards?.find((b) => b.id === current.id);
  if (current && summary) {
    return (
      <Board
        key={current.id}
        boardId={current.id}
        initial={current.board}
        username={username}
        onSignedOut={onSignedOut}
        title={
          <BoardSwitcher
            boards={boards!}
            current={current.id}
            onSelect={open}
            onCreate={create}
            onRename={(name) => rename(current.id, name)}
            onDelete={() => remove(current.id)}
          />
        }
      />
    );
  }
  // Nothing renders while the first board loads (a few milliseconds), so the header is not replaced under the user.
  if (boards?.length !== 0) return null;
  return (
    <AppShell username={username} onSignedOut={onSignedOut}>
      <Card className="mx-auto mt-16 w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>You have no boards yet</h1>
          </CardTitle>
          <CardDescription>Create a board to start tracking your work.</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm submit="Create board" onSubmit={create} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
