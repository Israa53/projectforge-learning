import { randomUUID } from "node:crypto";
import process from "node:process";
import { expect, test } from "@playwright/test";

test("creates, views, edits, and deletes a work item", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD before running this test.");
  }

  const title = `E2E invoice ${randomUUID().slice(0, 8)}`;
  const updatedTitle = `${title} - updated`;
  const description = "Validate invoice fields before submission.";

  const createForm = page.getByRole("form", { name: "Create a work item" });
  const editForm = page.getByRole("form", { name: "Edit work item" });
  const heading = (name: string) =>
    page.getByRole("heading", { name, exact: true });

  await test.step("Sign in", async () => {
    await page.goto("/work-items");
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);

    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(heading("Work items")).toBeVisible();
  });

  await test.step("Create a work item", async () => {
    await createForm.getByLabel("Title", { exact: true }).fill(title);
    await createForm
      .getByLabel("Description", { exact: true })
      .fill(description);
    await createForm
      .getByRole("button", { name: "Create", exact: true })
      .click();

    await expect(heading(title)).toBeVisible();
    await expect(createForm.getByLabel("Title", { exact: true })).toHaveValue(
      "",
    );
  });

  const detailsUrl =
    await test.step("Open the details with the eye icon", async () => {
      await page
        .getByRole("link", { name: `View details for ${title}` })
        .click();

      await expect(page).toHaveURL(/\/work-items\/[^/?#]+$/);
      await expect(heading(title)).toBeVisible();
      await expect(page.getByText(description, { exact: true })).toBeVisible();

      const url = page.url();
      await page.getByRole("link", { name: /back to work items/i }).click();
      return url;
    });

  await test.step("Edit the item and verify the saved title", async () => {
    await page
      .getByRole("button", { name: `Edit ${title}`, exact: true })
      .click();

    const titleInput = editForm.getByLabel("Title", { exact: true });
    await expect(titleInput).toHaveValue(title);
    await titleInput.fill(updatedTitle);
    await editForm.getByRole("button", { name: "Save", exact: true }).click();

    await expect(heading(updatedTitle)).toBeVisible();
    await expect(createForm).toBeVisible();
  });

  await test.step("Delete the item and verify its detail URL is unavailable", async () => {
    await page
      .getByRole("button", { name: `Delete ${updatedTitle}`, exact: true })
      .click();

    await page
      .getByRole("group", { name: `Confirm deletion of ${updatedTitle}` })
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect(heading(updatedTitle)).toHaveCount(0);

    await page.goto(detailsUrl);
    await expect(heading("Work item not found.")).toBeVisible();
  });
});
