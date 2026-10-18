import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const tones = {
    neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
    success:
      "border-transparent bg-[var(--accent-soft)] text-[var(--success)]",
    warning:
      "border-transparent bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "border-transparent bg-[var(--danger-soft)] text-[var(--danger)]",
    accent: "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold tracking-[0.02em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
