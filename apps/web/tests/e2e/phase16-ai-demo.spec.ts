import { expect, test } from "@playwright/test";

const email = process.env.PHASE14_TEST_EMAIL;
const password = process.env.PHASE14_TEST_PASSWORD;

test.describe("FASE 16 AI demo smoke", () => {
  test.skip(!email || !password, "A temporary confirmed test user is required.");

  test("suggests, classifies and extracts through the real UI without OpenAI network calls", async ({ page }) => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await page.goto("/login");
    await page.getByLabel("Email").first().fill(email!);
    await page.getByLabel("Contrasena").fill(password!);
    await page.getByRole("button", { name: "Entrar con contrasena" }).click();
    await page.getByLabel("Nombre").fill(`AI Demo ${stamp}`);
    await page.getByRole("button", { name: "Crear workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/assistants/new");
    await expect(page).toHaveURL(/\/assistants\/new/);
    await page.getByLabel("Nombre").fill(`AI Assistant ${stamp}`);
    await page.getByLabel("Prompt").fill("Responde como asesor comercial usando solamente el contexto CRM disponible.");
    await page.getByLabel("Mensaje fallback").fill("Un asesor continuara la conversacion.");
    await page.getByRole("button", { name: "Crear asistente" }).click();
    await expect(page).toHaveURL(/\/assistants\/[0-9a-f-]+$/);

    await page.goto("/smart-tags/new");
    await page.getByLabel("Nombre").fill("Presupuesto");
    await page.getByLabel("Prompt de clasificacion").fill("Detectar cuando el cliente menciona presupuesto o precio.");
    await page.getByRole("button", { name: "Crear Smart Tag" }).click();
    await expect(page).toHaveURL(/\/smart-tags\/[0-9a-f-]+$/);

    await page.goto("/variables/new");
    await page.getByLabel("Nombre").fill("Presupuesto");
    await page.getByLabel("Key").fill(`presupuesto_${Date.now()}`);
    await page.getByLabel("Tipo").selectOption("price");
    await page.getByLabel("Prompt de extraccion").fill("Extraer el monto de presupuesto mencionado por el cliente.");
    await page.getByRole("button", { name: "Crear variable" }).click();
    await expect(page).toHaveURL(/\/variables\/[0-9a-f-]+$/);

    await page.goto("/leads/new");
    await page.getByLabel("Nombre").fill("Lead AI");
    await page.getByLabel("Apellido").fill("Demo");
    await page.getByRole("button", { name: "Crear lead" }).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
    await page.getByRole("button", { name: "Conversacion" }).click();
    await expect(page).toHaveURL(/\/inbox\?conversation=/);
    const inboxUrl = page.url();

    await page.getByPlaceholder("Escribir mensaje manual").fill("Mi presupuesto es $1500 y quiero conocer el precio.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    await page.getByRole("button", { name: "Sugerir respuesta con IA" }).click();
    await expect(page.getByText("Borrador IA para revision humana")).toBeVisible();
    await expect(page.getByText("Sugerencia generada en modo demo")).toBeVisible();

    await page.getByRole("button", { name: "Analizar tags con IA" }).click();
    await expect(page.getByText(/tags detectados/)).toBeVisible();

    await page.getByRole("button", { name: "Extraer variables con IA" }).click();
    await expect(page.getByText(/variables extraidas/)).toBeVisible();
    await expect(page.getByText("1500 · 0.82")).toBeVisible();

    await page.goto(inboxUrl);
    await expect(page.getByText("Presupuesto", { exact: true }).first()).toBeVisible();
  });
});
