import { getAdminPb } from "@/lib/pocketbase/admin";
import { escapeFilterValue } from "@/lib/pocketbase/filter-escape";

/**
 * Deletes an expense. If the group has no expenses left, removes all settlements for that group.
 */
export async function removeExpenseAndClearSettlementsIfLedgerEmpty(
  expenseId: string,
  groupId: string
): Promise<boolean> {
  const pb = await getAdminPb();
  await pb.collection("expenses").delete(expenseId);

  const remaining = await pb.collection("expenses").getList(1, 1, {
    filter: `group = "${escapeFilterValue(groupId)}"`,
  });
  if (remaining.totalItems > 0) {
    return false;
  }

  const settlements = await pb.collection("settlements").getFullList({
    filter: `group = "${escapeFilterValue(groupId)}"`,
  });
  let cleared = false;
  for (const s of settlements) {
    await pb.collection("settlements").delete(s.id);
    cleared = true;
  }
  return cleared;
}
