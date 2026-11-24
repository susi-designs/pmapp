"use client";

import { KanbanSquare } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { send, UNREACHABLE } from "@/lib/api";

const RULES = "Username: 3 to 32 letters, digits, dots, dashes or underscores. Password: at least 8 characters.";

export function Login({ onSignedIn }: { onSignedIn: (username: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await send("POST", creating ? "/api/register" : "/api/login", { username, password });
    setBusy(false);
    if (res?.ok) return onSignedIn((await res.json()).username);
    if (!res) setError(UNREACHABLE);
    else if (!creating) setError("Invalid username or password");
    else if (res.status === 409) setError("That username is taken. Try another one.");
    else setError("Check the username and password against the rules above.");
  };

  const toggle = () => {
    setCreating(!creating);
    setError("");
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold">
            <KanbanSquare className="size-5 text-primary" aria-hidden />
            Kanban
          </div>
          <h1 className="text-xl font-semibold">{creating ? "Create your account" : "Welcome back"}</h1>
          <CardDescription>{creating ? "Your first board is ready when you are." : "Sign in to your boards."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoFocus
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete={creating ? "new-password" : "current-password"}
                aria-describedby={creating ? "rules" : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {creating && (
              <p id="rules" className="text-xs text-muted-foreground">
                {RULES}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {creating ? "Create account" : "Sign in"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
          {creating ? "Already have an account?" : "New here?"}
          <Button variant="link" className="h-auto p-0" onClick={toggle}>
            {creating ? "Sign in instead" : "Create an account"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
