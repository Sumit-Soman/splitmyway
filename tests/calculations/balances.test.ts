import { describe, it, expect } from "vitest";
import { calculateBalances, minimizeDebts } from "@/lib/calculations/balances";

describe("balances", () => {
  it("single expense balances", () => {
    const b = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidById: "a",
          participants: [
            { userId: "a", amount: 30 },
            { userId: "b", amount: 30 },
          ],
        },
      ],
      settlements: [],
    });
    expect(b["a"]).toBeCloseTo(30, 2);
    expect(b["b"]).toBeCloseTo(-30, 2);
  });

  it("minimizeDebts", () => {
    const b = { a: 10, b: -10 };
    const txs = minimizeDebts(b);
    expect(txs.length).toBe(1);
    expect(txs[0]!.fromId).toBe("b");
    expect(txs[0]!.toId).toBe("a");
    expect(txs[0]!.amount).toBeCloseTo(10, 2);
  });
});
