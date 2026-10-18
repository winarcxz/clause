import { formatUnitsExact, parseUnitsExact } from "@/lib/domain/money";

describe("parseUnitsExact", () => {
  it("converts an exact decimal value to integer base units", () => {
    expect(parseUnitsExact("1.000001", 6)).toBe(1_000_001n);
  });

  it("accepts the smallest representable positive unit", () => {
    expect(parseUnitsExact("0.000001", 6)).toBe(1n);
  });

  it.each(["1.0000001", "-1", "1e3", "1,000", ".5", "01"])(
    "rejects unsafe decimal input %s",
    (value) => {
      expect(() => parseUnitsExact(value, 6)).toThrow();
    },
  );

  it("rejects unsupported decimal precision", () => {
    expect(() => parseUnitsExact("1", 256)).toThrow();
  });
});

describe("formatUnitsExact", () => {
  it("formats base units without losing precision", () => {
    expect(formatUnitsExact(1_000_001n, 6)).toBe("1.000001");
  });

  it("removes insignificant fractional zeroes", () => {
    expect(formatUnitsExact(1_500_000n, 6)).toBe("1.5");
  });
});
