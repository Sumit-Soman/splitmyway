import { describe, expect, it } from "vitest";
import { sanitizeMemberSearchRaw } from "@/lib/member-search";

describe("sanitizeMemberSearchRaw", () => {
  it("returns null for short queries", () => {
    expect(sanitizeMemberSearchRaw("ab")).toBeNull();
    expect(sanitizeMemberSearchRaw("  a  ")).toBeNull();
  });

  it("strips sql wildcards and caps length", () => {
    expect(sanitizeMemberSearchRaw("hello%_\\world")).toBe("helloworld");
    const long = sanitizeMemberSearchRaw("a".repeat(60));
    expect(long).not.toBeNull();
    expect(long!.length).toBe(48);
  });
});
