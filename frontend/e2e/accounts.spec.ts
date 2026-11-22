import { expect, test } from "@playwright/test";
import { logOut, openAccount, register, resetBoard, signIn } from "./helpers";

// A unique name per run, because the database persists between runs.
const name = `e2e_${Date.now().toString(36)}`;

test.describe.serial("a new account", () => {
  test("can be created and starts with the demo board", async ({ page }) => {
    await register(page, name, "first-password");
    await expect(page.getByRole("button", { name: `Account ${name}` })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("My first board");
    await expect(page.getByTestId("card")).toHaveCount(8);
  });

  test("has its own boards, separate from other users", async ({ page }) => {
    await resetBoard(page); // other tests leave the demo user's boards in any state
    await page.request.post("/api/logout"); // resetBoard signed this browser in as the demo user
    await signIn(page, name, "first-password");
    await page.getByText("Define product vision").hover();
    await page.getByRole("button", { name: "Delete Define product vision" }).click();
    await expect(page.getByTestId("card")).toHaveCount(7);
    await logOut(page);
    await signIn(page);
    await expect(page.getByText("Define product vision")).toBeVisible();
  });

  test("cannot reuse a taken name, in any case", async ({ page }) => {
    await register(page, name.toUpperCase(), "first-password");
    await expect(page.getByText("That username is taken. Try another one.")).toBeVisible();
  });

  test("can change its password", async ({ page }) => {
    await signIn(page, name, "first-password");
    await openAccount(page, "Change password");
    await page.getByLabel("Current password").fill("first-password");
    await page.getByLabel("New password").fill("second-password");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await logOut(page);
    await signIn(page, name, "first-password");
    await expect(page.getByText("Invalid username or password")).toBeVisible();
    await signIn(page, name, "second-password");
    await expect(page.getByRole("button", { name: `Account ${name}` })).toBeVisible();
  });

  test("can be deleted, after which it cannot sign in", async ({ page }) => {
    await signIn(page, name, "second-password");
    await openAccount(page, "Delete account");
    await page.getByLabel("Enter your password to confirm").fill("second-password");
    await page.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await signIn(page, name, "second-password");
    await expect(page.getByText("Invalid username or password")).toBeVisible();
  });
});

test("sign up explains the username and password rules", async ({ page }) => {
  await register(page, "x", "short");
  await expect(page.getByText("Check the username and password against the rules above.")).toBeVisible();
});

test("the account menu and dialogs work from the keyboard", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Account user" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Change password" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Current password")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Account user" })).toBeFocused();
});
