import { expect, test } from "@playwright/test";
import { createTestAccount } from "./helpers/createTestAccount";

test("protects an unsaved draft when signing out", async ({ page }) => {
  const { email, password } = await createTestAccount();

  let logoutRequests = 0;

  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/auth/logout" &&
      request.method() === "POST"
    ) {
      logoutRequests += 1;
    }
  });

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const form = page.getByRole("form", { name: "Create a work item" });
  const title = form.getByLabel("Title", { exact: true });
  const signOut = page.getByRole("button", {
    name: "Sign out",
    exact: true,
  });

  await expect(form).toBeVisible();
  await title.fill("My unfinished invoice");

  // Cancel: the draft and session must remain intact.
  await Promise.all([
    page.waitForEvent("dialog").then((dialog) => dialog.dismiss()),
    signOut.click(),
  ]);

  await expect(page).toHaveURL(/\/work-items$/);
  await expect(title).toHaveValue("My unfinished invoice");
  expect(logoutRequests).toBe(0);

  // Confirm: the app should sign out.
  await Promise.all([
    page.waitForEvent("dialog").then((dialog) => dialog.accept()),
    signOut.click(),
  ]);

  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();

  expect(logoutRequests).toBe(1);
});
