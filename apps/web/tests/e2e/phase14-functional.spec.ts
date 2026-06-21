import { expect, test } from "@playwright/test";

const email = process.env.PHASE14_TEST_EMAIL;
const password = process.env.PHASE14_TEST_PASSWORD;

test.describe("FASE 14 real functional recovery", () => {
  test.skip(!email || !password, "A temporary confirmed test user is required.");

  test("operates the CRM modules end-to-end through the UI", async ({ page }) => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/login");
    await page.getByLabel("Email").first().fill(email!);
    await page.getByLabel("Contrasena").fill(password!);
    await page.getByRole("button", { name: "Entrar con contrasena" }).click();
    await expect(page).toHaveURL(/\/onboarding/);

    await page.getByLabel("Nombre").fill(`Phase 14 ${stamp}`);
    await page.getByRole("button", { name: "Crear workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leads" }).first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Abrir navegacion").click();
    await expect(page.getByRole("link", { name: "Leads", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.getByRole("link", { name: "Nuevo lead" }).click();
    await page.getByLabel("Nombre").fill("Lead Phase");
    await page.getByLabel("Apellido").fill("Fourteen");
    await page.getByLabel("Email").fill(`lead-${stamp}@example.com`);
    await page.getByLabel("Telefono").fill("+5491100001414");
    await page.getByRole("button", { name: "Crear lead" }).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Lead Phase Fourteen" })).toBeVisible();

    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Empresa").fill("Functional Recovery");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Functional Recovery")).toBeVisible();

    await page.getByRole("button", { name: "Conversacion" }).click();
    await expect(page).toHaveURL(/\/inbox\?conversation=/);
    await page.getByPlaceholder("Escribir mensaje manual").fill("Mensaje funcional Phase 14");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText("Mensaje funcional Phase 14").last()).toBeVisible();

    await page.goto("/contacts/new");
    await page.getByLabel("Nombre").fill("Contacto Phase");
    await page.getByLabel("Apellido").fill("Fourteen");
    await page.getByLabel("Email").fill(`contact-${stamp}@example.com`);
    await page.getByRole("button", { name: "Crear contacto" }).click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Contacto Phase Fourteen" })).toBeVisible();

    await page.goto("/assistants/new");
    await page.getByLabel("Nombre").fill(`Assistant ${stamp}`);
    await page.getByLabel("Canal").fill("manual");
    await page.getByLabel("Prompt").fill("Responde como asesor comercial usando solo el contexto CRM disponible.");
    await page.getByLabel("Mensaje fallback").fill("Un asesor continuara la conversacion.");
    await page.getByRole("button", { name: "Crear asistente" }).click();
    await expect(page).toHaveURL(/\/assistants\/[0-9a-f-]+$/);

    await page.goto("/smart-tags/new");
    await page.getByLabel("Nombre").fill(`Tag ${stamp}`);
    await page.getByLabel("Prompt de clasificacion").fill("Clasificar cuando el lead solicite una demostracion comercial.");
    await page.getByRole("button", { name: "Crear Smart Tag" }).click();
    await expect(page).toHaveURL(/\/smart-tags\/[0-9a-f-]+$/);

    await page.goto("/variables/new");
    await page.getByLabel("Nombre").fill(`Budget ${stamp}`);
    await page.getByLabel("Key").fill(`budget_${Date.now()}`);
    await page.getByLabel("Prompt de extraccion").fill("Extraer el presupuesto comercial mencionado por el cliente.");
    await page.getByRole("button", { name: "Crear variable" }).click();
    await expect(page).toHaveURL(/\/variables\/[0-9a-f-]+$/);

    await page.goto("/automations/new");
    await page.getByLabel("Nombre").fill(`Automation ${stamp}`);
    await page.getByRole("button", { name: "Crear automatizacion" }).click();
    await expect(page).toHaveURL(/\/automations\/[0-9a-f-]+$/);
    await page.getByRole("button", { name: "Ejecutar manual" }).click();
    await expect(page).toHaveURL(/run=1/);

    await page.goto("/integrations/new");
    await page.getByLabel("Nombre").fill(`Integration ${stamp}`);
    await page.getByLabel("Activa").check();
    await page.getByRole("button", { name: "Crear Custom Connect" }).click();
    await expect(page).toHaveURL(/\/integrations\/[0-9a-f-]+$/);
    await page.getByRole("button", { name: "Probar herramienta" }).click();
    await expect(page).toHaveURL(/status=success/);
  });
});
