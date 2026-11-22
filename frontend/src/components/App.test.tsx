import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { App } from "@/components/App";
import { UNREACHABLE } from "@/lib/api";
import { fakeServer } from "@/test/fakeServer";
import { renderWithProviders } from "@/test/render";

beforeEach(() => {
  vi.unstubAllGlobals();
});

const user = userEvent.setup();

async function fill(username: string, password: string) {
  await user.type(await screen.findByLabelText("Username"), username);
  await user.type(screen.getByLabelText("Password"), password);
}

async function signIn(username = "user", password = "password") {
  await fill(username, password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

async function openAccount(item: string) {
  await user.click(await screen.findByRole("button", { name: /^Account/ }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

test("shows the sign-in screen when signed out", async () => {
  fakeServer();
  renderWithProviders(<App />);
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  expect(screen.queryByTestId("column")).not.toBeInTheDocument();
});

test("opens the app straight away with an existing session", async () => {
  fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  expect(await screen.findByRole("button", { name: "Account user" })).toBeInTheDocument();
});

test("signs in", async () => {
  fakeServer();
  renderWithProviders(<App />);
  await signIn();
  expect(await screen.findByRole("button", { name: "Account user" })).toBeInTheDocument();
  expect(await screen.findAllByTestId("column")).toHaveLength(3);
});

test("rejects a wrong password", async () => {
  fakeServer();
  renderWithProviders(<App />);
  await signIn("user", "wrong-password");
  expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
  expect(screen.queryByTestId("column")).not.toBeInTheDocument();
});

test("explains when the server cannot be reached", async () => {
  const server = fakeServer();
  renderWithProviders(<App />);
  await screen.findByLabelText("Username");
  server.down = true;
  await signIn();
  expect(await screen.findByText(UNREACHABLE)).toBeInTheDocument();
});

test("creates an account", async () => {
  fakeServer();
  renderWithProviders(<App />);
  await user.click(await screen.findByRole("button", { name: "Create an account" }));
  expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();

  await fill("user", "long-enough");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText("That username is taken. Try another one.")).toBeInTheDocument();

  await user.clear(screen.getByLabelText("Username"));
  await user.type(screen.getByLabelText("Username"), "x");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText("Check the username and password against the rules above.")).toBeInTheDocument();

  await user.clear(screen.getByLabelText("Username"));
  await user.type(screen.getByLabelText("Username"), "alice");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("button", { name: "Account alice" })).toBeInTheDocument();
});

test("switching between sign in and create account clears the error", async () => {
  fakeServer();
  renderWithProviders(<App />);
  await signIn("user", "wrong-password");
  await screen.findByText("Invalid username or password");
  await user.click(screen.getByRole("button", { name: "Create an account" }));
  expect(screen.queryByText("Invalid username or password")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sign in instead" }));
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
});

test("logs out", async () => {
  const server = fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  await openAccount("Log out");
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  expect(server.signedIn).toBeNull();
});

test("changes the password", async () => {
  const server = fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  await openAccount("Change password");
  const dialog = await screen.findByRole("dialog", { name: "Change password" });
  await user.type(screen.getByLabelText("Current password"), "wrong-password");
  await user.type(screen.getByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Change password" }));
  expect(await screen.findByText("That is not your current password. Try again.")).toBeInTheDocument();

  await user.clear(screen.getByLabelText("Current password"));
  await user.type(screen.getByLabelText("Current password"), "password");
  await user.clear(screen.getByLabelText("New password"));
  await user.type(screen.getByLabelText("New password"), "short");
  await user.click(screen.getByRole("button", { name: "Change password" }));
  expect(await screen.findByText("The new password needs at least 8 characters.")).toBeInTheDocument();

  await user.clear(screen.getByLabelText("New password"));
  await user.type(screen.getByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Change password" }));
  expect(await screen.findByText("Password changed")).toBeInTheDocument();
  expect(dialog).not.toBeInTheDocument();
  expect(server.users.get("user")).toBe("new-password");
});

test("cancelling the password dialog keeps the password", async () => {
  const server = fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  await openAccount("Change password");
  await user.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(server.users.get("user")).toBe("password");
});

test("deletes the account after checking the password", async () => {
  const server = fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  await openAccount("Delete account");
  await screen.findByRole("alertdialog", { name: "Delete your account?" });
  await user.type(screen.getByLabelText("Enter your password to confirm"), "wrong-password");
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  expect(await screen.findByText("That password is not right. Try again.")).toBeInTheDocument();
  expect(server.users.has("user")).toBe(true);

  await user.clear(screen.getByLabelText("Enter your password to confirm"));
  await user.type(screen.getByLabelText("Enter your password to confirm"), "password");
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  expect(await screen.findByText("Account deleted")).toBeInTheDocument();
  expect(server.users.has("user")).toBe(false);
});

test("account dialogs explain when the server cannot be reached", async () => {
  const server = fakeServer({ signedIn: "user" });
  renderWithProviders(<App />);
  await openAccount("Change password");
  server.down = true;
  await user.type(await screen.findByLabelText("Current password"), "password");
  await user.type(screen.getByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Change password" }));
  expect(await screen.findByText(UNREACHABLE)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  await openAccount("Delete account");
  await user.type(await screen.findByLabelText("Enter your password to confirm"), "password");
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  expect(await screen.findByText(UNREACHABLE)).toBeInTheDocument();
});
