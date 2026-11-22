"use client";

import { Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { send } from "@/lib/api";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Add a card called Launch email to To Do",
  "Move the first Backlog card to In Progress",
  "Summarise what is in progress",
];

/** The conversation for one board. Board owns it, so it survives closing the panel and resets with the board. */
export function useChat(boardId: number, onBoard: (board: Board) => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const ask = async (text: string) => {
    const history = messages;
    // The message shows straight away and stays if the request fails.
    setMessages([...history, { role: "user", content: text }]);
    setFailed(false);
    setPending(true);
    const res = await send("POST", `/api/boards/${boardId}/chat`, { message: text, history });
    setPending(false);
    if (!res?.ok) return setFailed(true);
    const reply: { message: string; board: Board | null } = await res.json();
    setMessages((list) => [...list, { role: "assistant", content: reply.message }]);
    // The backend already saved this board, so it replaces the state without another save.
    if (reply.board) onBoard(reply.board);
  };

  return { messages, pending, failed, ask };
}

/** "Ask AI" and the chat panel. Non-modal, so the board stays usable and visibly updates while it is open. */
export function ChatSheet({ chat }: { chat: ReturnType<typeof useChat> }) {
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [chat.messages, chat.pending]);

  const submit = () => {
    const message = text.trim();
    if (!message || chat.pending) return;
    setText("");
    chat.ask(message);
  };

  return (
    <Sheet modal={false}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Sparkles />
          <span className="sr-only sm:not-sr-only">Ask AI</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="gap-0 p-0 sm:max-w-sm"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          input.current?.focus();
        }}
        // Keep the panel open while the user works on the board next to it.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b">
          <SheetTitle>AI assistant</SheetTitle>
          <SheetDescription>Works on this board: it can add, edit and move cards and change columns.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {chat.messages.length === 0 && (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  className="h-auto justify-start py-2 text-left whitespace-normal"
                  onClick={() => {
                    setText(s);
                    input.current?.focus();
                  }}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
          {chat.messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <p
                data-testid={`chat-${m.role}`}
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.content}
              </p>
            </div>
          ))}
          {chat.pending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Thinking...
            </p>
          )}
          {chat.failed && (
            <p role="alert" className="text-sm font-medium text-destructive">
              The AI request failed. Send your message again to retry.
            </p>
          )}
          <div ref={end} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-2 border-t p-3"
        >
          <Label htmlFor="chat-message" className="sr-only">
            Chat message
          </Label>
          <Textarea
            id="chat-message"
            ref={input}
            rows={2}
            placeholder="Ask the AI to change this board"
            className="resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Enter sends, Shift+Enter adds a line.</p>
            <Button type="submit" size="sm" disabled={chat.pending}>
              <SendHorizontal />
              Send
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
