import { expect, test } from "@playwright/test";

test("@smoke login page renders magic link form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar a CRM PRO AI" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
