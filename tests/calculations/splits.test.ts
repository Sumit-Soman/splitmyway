import { describe, it, expect } from "vitest";
import { calculateSplit } from "@/lib/calculations/splits";

describe("calculateSplit", () => {
  it("equal splits with remainder", () => {
    const r = calculateSplit({
      method: "equal",
      totalAmount: 10,
      participantIds: ["a", "b", "c"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sum = Object.values(r.amounts).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(10, 2);
  });

  it("exact requires matching total", () => {
    const r = calculateSplit({
      method: "exact",
      totalAmount: 10,
      participantIds: ["a", "b"],
      exactAmounts: { a: 4, b: 4 },
    });
    expect(r.ok).toBe(false);
  });

  it("percentage sums to 100", () => {
    const r = calculateSplit({
      method: "percentage",
      totalAmount: 100,
      participantIds: ["a", "b"],
      percentages: { a: 50, b: 50 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.values(r.amounts).reduce((x, y) => x + y, 0)).toBeCloseTo(100, 2);
  });
});
