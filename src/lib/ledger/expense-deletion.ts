import { workerFetchJson } from "@/lib/worker/client";

/**
 * Deletes an expense via the Worker API. If the group has no expenses left, the Worker clears payments.
 */
export async function removeExpenseAndClearSettlementsIfLedgerEmpty(
  expenseId: string,
  _groupId: string
): Promise<{ clearedSettlements: boolean; groupId: string }> {
  return workerFetchJson<{ clearedSettlements: boolean; groupId: string }>(
    `/v1/expenses/${encodeURIComponent(expenseId)}`,
    { method: "DELETE" }
  );
}
