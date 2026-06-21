import { expect, test } from "@playwright/test";

const email = process.env.PHASE14_TEST_EMAIL;
const password = process.env.PHASE14_TEST_PASSWORD;

test.describe("FASE 15 real pipeline", () => {
  test.skip(!email || !password, "A temporary confirmed test user is required.");

  test("moves a real lead through the Kanban and persists the status", async ({ page }) => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const leadName = `Pipeline ${stamp}`;

    await page.goto("/login");
    await page.getByLabel("Email").first().fill(email!);
    await page.getByLabel("Contrasena").fill(password!);
    await page.getByRole("button", { name: "Entrar con contrasena" }).click();
    await expect(page).toHaveURL(/\/onboarding/);

    await page.getByLabel("Nombre").fill(`Pipeline Workspace ${stamp}`);
    await page.getByRole("button", { name: "Crear workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/leads/new");
    await page.getByLabel("Nombre").fill(leadName);
    await page.getByLabel("Email").fill(`pipeline-${stamp}@example.com`);
    await page.getByLabel("Telefono").fill("+5491100001515");
    await page.getByLabel("Origen").fill("fase-15-e2e");
    await page.getByRole("button", { name: "Crear lead" }).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);

    const leadId = page.url().split("/").at(-1);
    expect(leadId).toBeTruthy();

    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();
    await expect(page.getByTestId("pipeline-column-nuevo").getByRole("link", { name: leadName })).toBeVisible();

    await page.getByPlaceholder("Buscar nombre, email o telefono").fill(leadName);
    await expect(page.getByText("1 de 1 leads visibles")).toBeVisible();
    await page.getByLabel("Filtrar por origen").selectOption("fase-15-e2e");
    await expect(page.getByText("1 de 1 leads visibles")).toBeVisible();
    await page.getByLabel("Filtrar por responsable").selectOption("unassigned");
    await expect(page.getByText("1 de 1 leads visibles")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar" }).click();

    const dragHandle = page.getByRole("button", { name: `Mover ${leadName}` });
    const interestedColumn = page.getByTestId("pipeline-column-interesado");
    const handleBox = await dragHandle.boundingBox();
    const targetBox = await interestedColumn.boundingBox();
    expect(handleBox).toBeTruthy();
    expect(targetBox).toBeTruthy();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 10, handleBox!.y + 10, { steps: 3 });
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + 180, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByText(`${leadName} ahora esta en Interesado.`)).toBeVisible();
    await expect(interestedColumn.getByTestId(`pipeline-lead-${leadId}`)).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("pipeline-column-interesado").getByTestId(`pipeline-lead-${leadId}`)).toBeVisible();
    await expect(page.getByLabel(`Cambiar estado de ${leadName}`)).toHaveValue("interesado");
  });
});
