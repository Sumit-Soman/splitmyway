import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Asserts dashboard “Total spend” for a group row (locale-agnostic: matches the numeric total).
 */
export async function expectDashboardGroupTotalSpend(
  page: Page,
  groupName: string,
  expectedTotal: number
): Promise<void> {
  const row = page.locator(`[data-e2e-dashboard-group="${groupName}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  const spend = row.locator("[data-e2e-total-spend]");
  await expect(spend).toContainText(new RegExp(String(expectedTotal).replace(/\./g, "\\.") + "[.,]\\d{2}"));
}
