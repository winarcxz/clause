import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] shadow-[var(--shadow-xs)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)] focus:ring-3 focus:ring-[var(--ring-soft)]",
        className,
      )}
      {...props}
    />
  );
}
