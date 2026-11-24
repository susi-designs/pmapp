import { KanbanSquare } from "lucide-react";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";

type Props = {
  username: string;
  onSignedOut: () => void;
  /** Left side after the app name: the board name and switcher. */
  title?: ReactNode;
  /** Right side before the theme toggle. */
  actions?: ReactNode;
  children: ReactNode;
};

/** The page frame: a one-row header above the main area, one viewport tall. */
export function AppShell({ username, onSignedOut, title, actions, children }: Props) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <div className="flex shrink-0 items-center gap-2 font-heading font-semibold">
          <KanbanSquare className="size-5 text-primary" aria-hidden />
          <span className="hidden sm:inline">Kanban</span>
        </div>
        <Separator orientation="vertical" className="h-5 data-vertical:self-center" />
        <div className="flex min-w-0 items-center gap-1">{title}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
          <ThemeToggle />
          <AccountMenu username={username} onSignedOut={onSignedOut} />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
