import { vi } from "vitest";
import type { Board } from "@/lib/types";
import { demoBoard } from "@/test/demoBoard";

type StoredBoard = { id: number; name: string; board: Board };
type ChatBody = { message: string; history: { role: string; content: string }[] };
type ChatReply = { message: string; board: Board | null } | "fail";

/**
 * A fake backend installed as `fetch`. One browser: `signedIn` is the session's user. The signed-in user's boards
 * are `boards` (one demo board to start). Set `down` to simulate an unreachable server, `failSaves` to fail PUTs.
 * `chat` answers `POST /api/boards/{id}/chat` (it may return a promise to hold the reply); `chats` records requests.
 */
export function fakeServer({ signedIn = null as string | null, boards = [{ id: 1, name: "Roadmap", board: demoBoard() }] as StoredBoard[] } = {}) {
  const server = {
    users: new Map([["user", "password"]]),
    signedIn,
    down: false,
    failSaves: false,
    boards,
    puts: 0,
    chats: [] as ChatBody[],
    chat: async (body: ChatBody): Promise<ChatReply> => ({ message: `You said: ${body.message}`, board: null }),
  };
  let nextId = Math.max(0, ...boards.map((b) => b.id)) + 1;
  const json = (status: number, body: unknown = {}) => Response.json(body, { status });

  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (server.down) throw new TypeError("Failed to fetch");
    const body = init.body ? JSON.parse(init.body as string) : {};
    const route = `${init.method ?? "GET"} ${path}`;
    const known = (name: string) => [...server.users.keys()].find((u) => u.toLowerCase() === name.toLowerCase());

    if (route === "POST /api/login") {
      const name = known(body.username);
      if (!name || server.users.get(name) !== body.password) return json(401);
      server.signedIn = name;
      return json(200, { username: name });
    }
    if (route === "POST /api/register") {
      if (!/^[A-Za-z0-9._-]{3,32}$/.test(body.username) || body.password.length < 8) return json(422);
      if (known(body.username)) return json(409);
      server.users.set(body.username, body.password);
      server.signedIn = body.username;
      return json(201, { username: body.username });
    }
    if (route === "POST /api/logout") {
      server.signedIn = null;
      return json(200);
    }
    const user = server.signedIn;
    if (!user) return json(401);
    if (route === "GET /api/me") return json(200, { username: user });
    if (route === "PUT /api/me/password") {
      if (server.users.get(user) !== body.current) return json(403);
      if (body.new.length < 8) return json(422);
      server.users.set(user, body.new);
      return json(200);
    }
    if (route === "DELETE /api/me") {
      if (server.users.get(user) !== body.password) return json(403);
      server.users.delete(user);
      server.signedIn = null;
      return json(200);
    }
    if (route === "GET /api/boards") return json(200, server.boards.map(({ id, name }) => ({ id, name })));
    if (route === "POST /api/boards") {
      const created = { id: nextId++, name: body.name, board: { columns: [{ id: crypto.randomUUID(), title: "Backlog", cardIds: [] }], cards: {} } };
      server.boards.push(created);
      return json(201, { id: created.id, name: created.name });
    }
    const chatMatch = route.match(/^POST \/api\/boards\/(\d+)\/chat$/);
    if (chatMatch) {
      server.chats.push(body);
      const reply = await server.chat(body);
      if (reply === "fail") return json(502, { detail: "The AI request failed" });
      if (reply.board) server.boards.find((b) => b.id === Number(chatMatch[1]))!.board = reply.board;
      return json(200, reply);
    }
    const match = route.match(/^(\w+) \/api\/boards\/(\d+)$/);
    const stored = match && server.boards.find((b) => b.id === Number(match[2]));
    if (!stored) return json(404);
    if (match[1] === "GET") return json(200, stored.board);
    if (match[1] === "PATCH") {
      stored.name = body.name;
      return json(200, { id: stored.id, name: body.name });
    }
    if (match[1] === "DELETE") {
      server.boards = server.boards.filter((b) => b !== stored);
      return json(200);
    }
    server.puts++;
    if (server.failSaves) return json(500);
    stored.board = body;
    return json(200, body);
  });
  return server;
}
