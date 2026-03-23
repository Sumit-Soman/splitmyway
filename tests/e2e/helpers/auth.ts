import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const DASHBOARD = /\/dashboard/;

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await expect(page.getByTestId("e2e-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(DASHBOARD, { timeout: 60_000 });
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.getByTestId("e2e-user-menu").click();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForLoadState("domcontentloaded");
  await page.goto("/login");
  await expect(page.getByTestId("e2e-login-form")).toBeVisible({ timeout: 20_000 });
}

export async function expectLoggedInDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(DASHBOARD);
  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible({ timeout: 20_000 });
}
