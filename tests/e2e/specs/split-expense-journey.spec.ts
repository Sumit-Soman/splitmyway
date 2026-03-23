/**
 * End-to-end: two users, shared group, expenses, deletion, settlement, cross-surface checks.
 *
 * Setup: root `.env` with DATABASE_URL + Supabase. Copy `tests/e2e/env.e2e.example` → `tests/e2e/.env.local`
 * and add SUPABASE_SERVICE_ROLE_KEY to auto-provision test users before the run.
 */
import { test, expect } from "@playwright/test";
import { E2E, uniqueGroupName } from "../fixtures/constants";
import { expectLoggedInDashboard, loginAs, logoutViaUi } from "../helpers/auth";
import { expectDashboardGroupTotalSpend } from "../helpers/dashboard";
import {
  addEqualExpense,
  addMemberByEmail,
  createGroup,
  deleteExpenseByDescription,
  groupDetailTab,
  openGroupFromList,
  recordSettlement,
} from "../helpers/group";

test.describe("Split expense journey", () => {
  test("full lifecycle: create → expenses → dashboard → delete → user B settles → new expense → verify both sides", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const groupName = uniqueGroupName();
    const { dinner, taxi, lunch } = E2E.expenses;

    await test.step("Login as primary user", async () => {
      await loginAs(page, E2E.userA.email, E2E.userA.password);
      await expectLoggedInDashboard(page);
    });

    await test.step("Create group (USD)", async () => {
      await createGroup(page, groupName, "USD");
    });

    await test.step("Invite second member (existing account)", async () => {
      await addMemberByEmail(page, E2E.userB.email, { joinedAsName: E2E.userB.displayName });
    });

    await test.step("Add two equal-split expenses (primary paid)", async () => {
      await groupDetailTab(page, "Expenses").click();
      await addEqualExpense(page, dinner.description, dinner.amount, [E2E.userA.email, E2E.userA.displayName]);
      await addEqualExpense(page, taxi.description, taxi.amount, [E2E.userA.email, E2E.userA.displayName]);
      await expect(page.getByText(dinner.description)).toBeVisible();
      await expect(page.getByText(taxi.description)).toBeVisible();
    });

    await test.step("Dashboard reflects group and total spend (sum of expenses)", async () => {
      await page.goto("/dashboard");
      await expect(page.locator(`[data-e2e-dashboard-group="${groupName}"]`)).toBeVisible();
      await expectDashboardGroupTotalSpend(page, groupName, 160);
    });

    await test.step("Balances tab loads net position and executive summary", async () => {
      await openGroupFromList(page, groupName);
      await groupDetailTab(page, "Balances").click();
      await expect(page.getByText(/Your net position/i)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /The group owes you|You owe the group, net|You are even with the group/ })
      ).toBeVisible();
    });

    await test.step("Delete one expense; counts update everywhere", async () => {
      await deleteExpenseByDescription(page, taxi.description);
      await expect(page.getByText(taxi.description)).toHaveCount(0);
      await expect(page.getByText(dinner.description)).toBeVisible();
      await page.goto("/dashboard");
      await expectDashboardGroupTotalSpend(page, groupName, 100);
    });

    await test.step("Logout primary; login as second user", async () => {
      await logoutViaUi(page);
      await loginAs(page, E2E.userB.email, E2E.userB.password);
      await expectLoggedInDashboard(page);
    });

    await test.step("Record partial settlement (member B → A)", async () => {
      await openGroupFromList(page, groupName);
      await recordSettlement(page, [E2E.userB.email, E2E.userB.displayName], [E2E.userA.email, E2E.userA.displayName], E2E.settlementAmount);
      await groupDetailTab(page, "Settlements").click();
      const settlementRe = new RegExp(`\\$?${E2E.settlementAmount}[.,]\\d{2}`);
      await expect(page.getByText(settlementRe)).toBeVisible();
    });

    await test.step("Second user adds equal-split expense", async () => {
      await groupDetailTab(page, "Expenses").click();
      await addEqualExpense(page, lunch.description, lunch.amount, [E2E.userB.email, E2E.userB.displayName]);
    });

    await test.step("Dashboard shows updated total spend for user B", async () => {
      await page.goto("/dashboard");
      await expect(page.locator(`[data-e2e-dashboard-group="${groupName}"]`)).toBeVisible();
      await expectDashboardGroupTotalSpend(page, groupName, 140);
    });

    await test.step("Primary user still sees all expenses after re-login", async () => {
      await logoutViaUi(page);
      await loginAs(page, E2E.userA.email, E2E.userA.password);
      await openGroupFromList(page, groupName);
      await groupDetailTab(page, "Expenses").click();
      await expect(page.getByText(dinner.description)).toBeVisible();
      await expect(page.getByText(lunch.description)).toBeVisible();
    });

    await test.step("Final logout", async () => {
      await logoutViaUi(page);
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    });
  });
});
