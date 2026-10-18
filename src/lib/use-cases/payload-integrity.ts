import { createHash } from "node:crypto";

type JsonPrimitive = boolean | number | string | null;
export type CanonicalJson =
  | JsonPrimitive
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function normalize(value: unknown): CanonicalJson {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON cannot contain non-finite numbers");
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }

  throw new TypeError(`Canonical JSON cannot contain ${typeof value}`);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function hashCanonicalPayload(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
