"use client";

import { useEffect, useState } from "react";
import { Login } from "@/components/Login";
import { Workspace } from "@/components/Workspace";
import { send } from "@/lib/api";

/** Auth gate: GET /api/me decides between the sign-in screen and the app (401 or no server means signed out). */
export function App() {
  // undefined while the first check is pending; nothing renders until it answers
  const [username, setUsername] = useState<string | null>();

  useEffect(() => {
    send("GET", "/api/me").then(async (res) => setUsername(res?.ok ? (await res.json()).username : null));
  }, []);

  if (username === undefined) return null;
  if (username === null) return <Login onSignedIn={setUsername} />;
  return <Workspace key={username} username={username} onSignedOut={() => setUsername(null)} />;
}
