import process from "node:process";
import { expect, test } from "@playwright/test";

test("signs in and restores the session after a full reload", async ({
  page,
}) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD before running this test.");
  }

  await page.goto("/work-items");
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const workItems = page.getByRole("heading", {
    name: "Work items",
    exact: true,
  });

  await expect(page).toHaveURL(/\/work-items$/);
  await expect(workItems).toBeVisible();

  const [refreshResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/refresh" &&
        response.request().method() === "POST",
    ),
    page.reload(),
  ]);

  expect(refreshResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/work-items$/);
  await expect(workItems).toBeVisible();
});
