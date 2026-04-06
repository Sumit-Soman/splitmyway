import { describe, expect, it } from "vitest";
import { calculateBalances } from "@/lib/calculations/balances";

/**
 * Ledger math is DB-agnostic; integration against PocketBase is covered by E2E / manual QA.
 */
describe("balance consistency (unit)", () => {
  it("empty ledger has zero balances", () => {
    const b = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [],
      settlements: [],
    });
    expect(b.a).toBe(0);
    expect(b.b).toBe(0);
  });
});
