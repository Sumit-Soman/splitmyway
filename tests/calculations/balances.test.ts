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

  it("settlement moves balances toward zero", () => {
    const b = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidById: "a",
          participants: [
            { userId: "a", amount: 50 },
            { userId: "b", amount: 50 },
          ],
        },
      ],
      settlements: [{ fromId: "b", toId: "a", amount: 50 }],
    });
    expect(b["a"]).toBeCloseTo(0, 2);
    expect(b["b"]).toBeCloseTo(0, 2);
  });

  it("settlements with no expenses still affect the math (orphans — app clears these when last expense is deleted)", () => {
    const b = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [],
      settlements: [{ fromId: "b", toId: "a", amount: 50 }],
    });
    expect(b["a"]).toBeCloseTo(-50, 2);
    expect(b["b"]).toBeCloseTo(50, 2);
  });

  it("partial settlement leaves remainder for minimizeDebts", () => {
    const b = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidById: "a",
          participants: [
            { userId: "a", amount: 50 },
            { userId: "b", amount: 50 },
          ],
        },
      ],
      settlements: [{ fromId: "b", toId: "a", amount: 20 }],
    });
    expect(b["a"]).toBeCloseTo(30, 2);
    expect(b["b"]).toBeCloseTo(-30, 2);
    const txs = minimizeDebts(b);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.fromId).toBe("b");
    expect(txs[0]!.toId).toBe("a");
    expect(txs[0]!.amount).toBeCloseTo(30, 2);
  });
});
