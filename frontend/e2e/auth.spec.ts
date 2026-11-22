import { expect, test } from "@playwright/test";
import { logOut, signIn } from "./helpers";

test("a signed-out visit shows the sign-in screen, not the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByTestId("board")).toHaveCount(0);
});

test("a wrong password is rejected", async ({ page }) => {
  await signIn(page, "user", "wrong-password");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
  await expect(page.getByTestId("board")).toHaveCount(0);
});

test("an unknown username is rejected", async ({ page }) => {
  await signIn(page, "nobody-here", "password");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
});

test("correct credentials open the app", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("button", { name: "Account user" })).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
});

test("the session survives a page refresh", async ({ page }) => {
  await signIn(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Account user" })).toBeVisible();
});

test("log out returns to the sign-in screen and stays signed out after refresh", async ({ page }) => {
  await signIn(page);
  await logOut(page);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("the session cookie is HttpOnly", async ({ page, context }) => {
  await signIn(page);
  await expect(page.getByRole("button", { name: "Account user" })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === "session");
  expect(cookie?.httpOnly).toBe(true);
});

test("the API rejects requests without a session", async ({ request }) => {
  expect((await request.get("/api/me")).status()).toBe(401);
});
