import { expect, test } from "@playwright/test";

test("landing page communicates the guarded execution flow", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`${message.text()} @ ${message.location().url}`);
    }
  });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "The safest way to let AI spend money.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Mandate validated")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  expect(consoleErrors).toEqual([]);
});
