import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading page">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export function QueryError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)]/40 p-8 text-center">
      <div>
        <AlertTriangle className="mx-auto size-5 text-[var(--danger)]" />
        <h2 className="mt-3 text-sm font-semibold">Unable to load this view</h2>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">{message}</p>
        <Button className="mt-4" size="sm" variant="secondary" onClick={retry}>
          <RotateCcw className="size-3.5" />
          Try again
        </Button>
      </div>
    </div>
  );
}
