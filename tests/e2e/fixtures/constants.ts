/**
 * Canonical identifiers for the split-expenses E2E journey.
 * Values can be overridden via environment (see env.e2e.example).
 */
export const E2E = {
  userA: {
    email: process.env.E2E_USER_A_EMAIL ?? "testuser@test.com",
    password: process.env.E2E_USER_A_PASSWORD ?? "Test@123",
    displayName: "Test User",
  },
  userB: {
    email: process.env.E2E_USER_B_EMAIL ?? "cooanju@gmail.com",
    password: process.env.E2E_USER_B_PASSWORD ?? "Test@123",
    displayName: "Anju",
  },
  expenses: {
    dinner: { description: "E2E Dinner", amount: "100" },
    taxi: { description: "E2E Taxi", amount: "60" },
    lunch: { description: "E2E Lunch", amount: "40" },
  },
  settlementAmount: "25",
  groupNamePrefix: "E2E-AUT",
} as const;

export function uniqueGroupName(): string {
  return `${E2E.groupNamePrefix}-${Date.now()}`;
}
