import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Group detail uses plain `<button>` triggers, not `role="tab"`. */
export function groupDetailTab(page: Page, label: "Expenses" | "Balances" | "Members" | "Settlements") {
  return page.getByRole("button", { name: label, exact: true });
}

async function settleAfterNavigation(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

export async function createGroup(page: Page, name: string, currencyValue: string): Promise<void> {
  await page.goto("/groups/new");
  await expect(page.getByRole("heading", { name: "New group" })).toBeVisible();
  await page.locator("#name").fill(name);
  await page.locator("#currency").selectOption(currencyValue);
  await page.getByRole("button", { name: "Create group" }).click();
  // Next.js client `router.push` does not always fire a document `load` event — poll URL instead.
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]+$/i, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 15_000 });
  // Next.js App Router can leave internal navigation pending; drain before further UI actions.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

export async function addMemberByEmail(
  page: Page,
  email: string,
  options?: { joinedAsName?: string }
): Promise<void> {
  await groupDetailTab(page, "Members").click();
  const emailInput = page.locator("#email");
  await expect(emailInput).toBeVisible({ timeout: 20_000 });
  await emailInput.fill(email);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const localPart = email.includes("@") ? (email.split("@")[0] ?? email) : email;
  const matchers = [
    page.getByText(email, { exact: true }),
    page.getByText(localPart, { exact: true }),
  ];
  if (options?.joinedAsName) {
    matchers.push(page.getByText(options.joinedAsName, { exact: true }));
  }
  let combined = matchers[0]!;
  for (let i = 1; i < matchers.length; i++) {
    combined = combined.or(matchers[i]!);
  }
  await expect(combined.first()).toBeVisible({ timeout: 25_000 });
}

export async function openGroupFromList(page: Page, groupName: string): Promise<void> {
  await page.goto("/groups");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.locator(`a:has-text("${groupName}")`).first().click();
  await expect(page.getByRole("heading", { name: groupName, exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

async function selectFirstMatchingLabel(select: Locator, labels: string[]): Promise<void> {
  await expect(select).toBeVisible({ timeout: 15_000 });
  const optionTexts = (await select.locator("option").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const norm = (s: string) => s.toLowerCase();
  for (const label of labels) {
    const nl = norm(label);
    const idx = optionTexts.findIndex((t) => {
      const nt = norm(t);
      return (
        nt === nl ||
        nt.includes(nl) ||
        (label.includes("@") && nt.includes(nl.split("@")[0] ?? nl))
      );
    });
    if (idx >= 0) {
      await select.selectOption({ index: idx });
      return;
    }
    try {
      await select.selectOption({ label }, { timeout: 3000 });
      return;
    } catch {
      /* try next label */
    }
  }
  throw new Error(`No matching option for [${labels.join(", ")}]; options: [${optionTexts.join(" | ")}]`);
}

export async function addEqualExpense(
  page: Page,
  description: string,
  amount: string,
  paidByOptionLabels: string[]
): Promise<void> {
  await page.getByTestId("e2e-open-add-expense").click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Description").fill(description);
  await dialog.locator("#amount").fill(amount);
  await selectFirstMatchingLabel(dialog.locator("#paidById"), paidByOptionLabels);
  await dialog.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Expense added")).toBeVisible({ timeout: 30_000 });
}

export async function deleteExpenseByDescription(page: Page, description: string): Promise<void> {
  await groupDetailTab(page, "Expenses").click();
  const card = page.locator(`[data-e2e-expense-desc="${description}"]`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: "Delete expense" }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Expense deleted")).toBeVisible({ timeout: 25_000 });
}

export async function recordSettlement(
  page: Page,
  fromLabels: string[],
  toLabels: string[],
  amount: string
) {
  await settleAfterNavigation(page);
  await expect(groupDetailTab(page, "Settlements")).toBeVisible({ timeout: 20_000 });
  await groupDetailTab(page, "Settlements").click();
  await page.getByRole("button", { name: "Record settlement" }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await selectFirstMatchingLabel(dialog.locator('select[name="fromId"]'), fromLabels);
  await selectFirstMatchingLabel(dialog.locator('select[name="toId"]'), toLabels);
  await dialog.locator("#samount").fill(amount);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settlement recorded")).toBeVisible({ timeout: 30_000 });
}
