import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-9 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--muted)]">
          <Icon className="size-4.5" />
        </span>
        <h2 className="mt-4 text-sm font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
