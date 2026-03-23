import type { Prisma } from "@prisma/client";

/**
 * Deletes an expense. If the group has no expenses left, removes all settlements for that group.
 *
 * Rationale: settlements are recorded against an expense-derived balance. If every expense is removed,
 * keeping old settlements would leave phantom “you owe / you’re owed” amounts with no underlying splits.
 * Clearing settlements matches the user expectation that an empty expense list means a clean slate.
 */
/** @returns true if all settlements for the group were removed (ledger had no expenses left). */
export async function removeExpenseAndClearSettlementsIfLedgerEmpty(
  tx: Prisma.TransactionClient,
  expenseId: string,
  groupId: string
): Promise<boolean> {
  await tx.expense.delete({ where: { id: expenseId } });
  const remaining = await tx.expense.count({ where: { groupId } });
  if (remaining === 0) {
    const { count } = await tx.settlement.deleteMany({ where: { groupId } });
    return count > 0;
  }
  return false;
}
