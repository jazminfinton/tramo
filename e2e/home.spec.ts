import { expect, test } from "@playwright/test";

test("sends anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
});

test("renders the stored theme on the server", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "palette", value: "indigo", url: baseURL },
    { name: "mode", value: "light", url: baseURL },
  ]);

  await page.goto("/sign-in");

  await expect(page.locator("html")).toHaveAttribute("data-palette", "indigo");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("ignores tampered theme cookies", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "palette", value: "<script>", url: baseURL },
    { name: "mode", value: "neon", url: baseURL },
  ]);

  await page.goto("/sign-in");

  await expect(page.locator("html")).toHaveAttribute("data-palette", "lima");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("maps sign-in errors to a known message", async ({ page }) => {
  await page.goto("/sign-in?error=%3Cb%3Ehacked%3C%2Fb%3E");

  await expect(page.getByRole("alert")).toHaveText("No se pudo iniciar sesión con Google. Probá de nuevo.");
});
