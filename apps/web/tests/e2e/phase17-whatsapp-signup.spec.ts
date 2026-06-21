import { expect, test } from "@playwright/test";

const email = process.env.PHASE14_TEST_EMAIL;
const password = process.env.PHASE14_TEST_PASSWORD;

test.describe("FASE 17 WhatsApp Embedded Signup", () => {
  test.skip(!email || !password, "A temporary confirmed test user is required.");

  test("shows the official connection flow without manual credential fields", async ({ page }) => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/login");
    await page.getByLabel("Email").first().fill(email!);
    await page.getByLabel("Contrasena").fill(password!);
    await page.getByRole("button", { name: "Entrar con contrasena" }).click();
    await page.getByLabel("Nombre").fill(`WhatsApp Signup ${stamp}`);
    await page.getByRole("button", { name: "Crear workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/settings/channels/whatsapp");
    await expect(page.getByRole("heading", { name: "Canal WhatsApp" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar WhatsApp" })).toBeVisible();
    await expect(page.getByText("Embedded Signup", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Phone Number ID")).toHaveCount(0);
    await expect(page.getByLabel("WhatsApp Business Account ID")).toHaveCount(0);
    await expect(page.getByLabel("Referencia del verify token")).toHaveCount(0);
  });
});
