import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { App } from "@/components/App";
import { demoBoard } from "@/test/demoBoard";
import { fakeServer } from "@/test/fakeServer";
import { renderWithProviders } from "@/test/render";

const user = userEvent.setup();

beforeEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

async function openChat(options?: Parameters<typeof fakeServer>[0]) {
  const server = fakeServer({ signedIn: "user", ...options });
  renderWithProviders(<App />);
  await screen.findAllByTestId("column");
  await user.click(screen.getByRole("button", { name: "Ask AI" }));
  await screen.findByRole("dialog", { name: "AI assistant" });
  return server;
}

const box = () => screen.getByLabelText("Chat message");

test("opens with focus in the message box and offers suggestions", async () => {
  await openChat();
  await waitFor(() => expect(box()).toHaveFocus());
  await user.click(screen.getByRole("button", { name: "Add a card called Launch email to To Do" }));
  expect(box()).toHaveValue("Add a card called Launch email to To Do");
  expect(box()).toHaveFocus();
});

test("shows the message at once, then the reply, and sends the history", async () => {
  const server = await openChat();
  let answer!: (reply: { message: string; board: null }) => void;
  server.chat = () => new Promise((resolve) => (answer = resolve));

  await user.type(box(), "Hello{Enter}");
  expect(screen.getByTestId("chat-user")).toHaveTextContent("Hello");
  expect(screen.getByText("Thinking...")).toBeInTheDocument();
  expect(box()).toHaveValue("");
  expect(screen.queryByRole("button", { name: /Launch email/ })).not.toBeInTheDocument();
  await user.type(box(), "Too soon{Enter}"); // ignored while waiting
  expect(server.chats).toHaveLength(1);

  answer({ message: "Hi there", board: null });
  expect(await screen.findByTestId("chat-assistant")).toHaveTextContent("Hi there");
  expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();

  server.chat = async () => ({ message: "Second", board: null });
  await user.clear(box());
  await user.type(box(), "Again");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Second");
  expect(server.chats[1]).toEqual({
    message: "Again",
    history: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
  });
});

test("Shift+Enter adds a line and blank messages are not sent", async () => {
  const server = await openChat();
  await user.type(box(), "   {Enter}");
  expect(server.chats).toHaveLength(0);
  await user.clear(box());
  await user.type(box(), "one{Shift>}{Enter}{/Shift}two");
  expect(box()).toHaveValue("one\ntwo");
});

test("a reply with a board updates the board without saving it again", async () => {
  const server = await openChat();
  const updated = demoBoard();
  updated.cards.n = { id: "n", title: "Added by AI", details: "", dueDate: null, priority: "high", labels: [] };
  updated.columns[1].cardIds.push("n");
  server.chat = async () => ({ message: "I added the card.", board: updated });
  await user.type(box(), "Add a card to Doing{Enter}");
  await screen.findByText("I added the card.");
  expect(within(screen.getByRole("region", { name: "Doing" })).getByText("Added by AI")).toBeInTheDocument();
  expect(server.puts).toBe(0);
});

test("a failed request keeps the message and explains how to retry", async () => {
  const server = await openChat();
  server.chat = async () => "fail";
  await user.type(box(), "Hello{Enter}");
  expect(await screen.findByText("The AI request failed. Send your message again to retry.")).toBeInTheDocument();
  expect(screen.getByTestId("chat-user")).toHaveTextContent("Hello");

  server.chat = async () => ({ message: "Back", board: null });
  await user.type(box(), "Hello again{Enter}");
  await screen.findByText("Back");
  expect(screen.queryByText(/The AI request failed/)).not.toBeInTheDocument();
});

test("closes with Escape or the close button, returns focus, and keeps the conversation", async () => {
  await openChat();
  await user.type(box(), "Hello{Enter}");
  await screen.findByText("You said: Hello");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Ask AI" })).toHaveFocus();

  await user.click(screen.getByRole("button", { name: "Ask AI" }));
  expect(await screen.findByText("You said: Hello")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("the board stays usable while the panel is open", async () => {
  await openChat();
  await user.click(screen.getByRole("button", { name: "Delete Review spec" }));
  expect(screen.queryByText("Review spec")).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "AI assistant" })).toBeInTheDocument();
});

test("switching boards starts a new conversation", async () => {
  await openChat({
    boards: [
      { id: 1, name: "Roadmap", board: demoBoard() },
      { id: 2, name: "Launch", board: demoBoard() },
    ],
  });
  await user.type(box(), "Hello{Enter}");
  await screen.findByText("You said: Hello");
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Boards" }));
  await user.click(await screen.findByRole("menuitem", { name: "Launch" }));
  await screen.findByRole("heading", { level: 1, name: "Launch" });
  await user.click(screen.getByRole("button", { name: "Ask AI" }));
  await screen.findByRole("dialog", { name: "AI assistant" });
  expect(screen.queryByTestId("chat-user")).not.toBeInTheDocument();
});
