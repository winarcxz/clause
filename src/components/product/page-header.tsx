import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.09em] text-[var(--accent)] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
