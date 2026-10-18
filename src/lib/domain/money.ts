const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new RangeError("Decimals must be an integer between 0 and 255");
  }
}

export function parseUnitsExact(value: string, decimals: number): bigint {
  assertDecimals(decimals);

  const match = DECIMAL_PATTERN.exec(value);
  if (!match) {
    throw new TypeError(`Invalid decimal amount: ${value}`);
  }

  const integerPart = match[1];
  const fractionalPart = match[2] ?? "";

  if (integerPart === undefined || fractionalPart.length > decimals) {
    throw new RangeError(`Amount exceeds ${decimals} decimal places`);
  }

  const paddedFraction = fractionalPart.padEnd(decimals, "0");
  const base = 10n ** BigInt(decimals);

  return BigInt(integerPart) * base + BigInt(paddedFraction || "0");
}

export function formatUnitsExact(value: bigint, decimals: number): string {
  assertDecimals(decimals);
  if (value < 0n) {
    throw new RangeError("Base-unit values cannot be negative");
  }

  if (decimals === 0) {
    return value.toString();
  }

  const base = 10n ** BigInt(decimals);
  const integerPart = value / base;
  const fractionalPart = (value % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fractionalPart.length > 0
    ? `${integerPart}.${fractionalPart}`
    : integerPart.toString();
}
