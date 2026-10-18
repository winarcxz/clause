"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Check,
  CircleDot,
  ExternalLink,
  FileClock,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";
import { PageSkeleton, QueryError } from "@/components/product/query-state";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client-api";
import type { AuditRecord } from "@/lib/product-types";

const successEvents = new Set([
  "VALIDATION_PASSED",
  "SIMULATION_SUCCEEDED",
  "EXECUTION_SUCCEEDED",
  "MANDATE_CREATED",
  "AI_RESUMED",
]);
const failureEvents = new Set([
  "VALIDATION_FAILED",
  "SIMULATION_FAILED",
  "EXECUTION_FAILED",
]);

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function EventIcon({ event }: { event: string }) {
  if (successEvents.has(event)) return <Check className="size-3.5" />;
  if (failureEvents.has(event)) return <X className="size-3.5" />;
  return <CircleDot className="size-3.5" />;
}

function ActorIcon({ actor }: { actor: string }) {
  if (actor === "AI") return <Bot className="size-3.5" />;
  if (actor === "USER") return <UserRound className="size-3.5" />;
  return <ShieldCheck className="size-3.5" />;
}

export default function AuditPage() {
  const query = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiFetch<AuditRecord[]>("/api/audit?take=120"),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) {
    return (
      <QueryError message={query.error.message} retry={() => void query.refetch()} />
    );
  }
  if (!query.data) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        eyebrow="Evidence ledger"
        title="Audit history"
        description="An immutable application trail from structured intent through validation, simulation, approval, and KeeperHub settlement."
        action={
          <Badge tone="accent">{query.data.length} recorded events</Badge>
        }
      />

      {query.data.length === 0 ? (
        <EmptyState
          icon={FileClock}
          title="The audit trail is empty"
          description="Mandate changes and agent execution attempts will be recorded here automatically."
        />
      ) : (
        <section className="relative mx-auto max-w-4xl">
          <div className="absolute bottom-5 left-[17px] top-5 w-px bg-[var(--border)] sm:left-[23px]" />
          <ol className="space-y-2">
            {query.data.map((event) => {
              const isSuccess = successEvents.has(event.type);
              const isFailure = failureEvents.has(event.type);
              return (
                <li
                  key={event.id}
                  className="relative grid grid-cols-[36px_1fr] gap-3 sm:grid-cols-[48px_1fr]"
                >
                  <span
                    className={`relative z-10 mt-4 grid size-9 place-items-center rounded-full border-4 border-[var(--background)] sm:size-11 ${
                      isSuccess
                        ? "bg-[var(--accent-soft)] text-[var(--success)]"
                        : isFailure
                          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                          : "bg-[var(--surface-strong)] text-[var(--muted)]"
                    }`}
                  >
                    <EventIcon event={event.type} />
                  </span>
                  <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold capitalize">
                            {readable(event.type)}
                          </h2>
                          <Badge
                            tone={isSuccess ? "success" : isFailure ? "danger" : "neutral"}
                          >
                            {event.actor.toLowerCase()}
                          </Badge>
                        </div>
                        {event.proposal?.explanation && (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                            {event.proposal.explanation}
                          </p>
                        )}
                      </div>
                      <time
                        dateTime={event.createdAt}
                        className="shrink-0 text-[11px] text-[var(--muted)]"
                      >
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <ActorIcon actor={event.actor} />
                        Actor: {event.actor}
                      </span>
                      {event.execution?.gasUsedWei && (
                        <span>Gas used: {event.execution.gasUsedWei}</span>
                      )}
                      {event.execution?.transactionHash && (
                        <span className="font-mono">
                          {event.execution.transactionHash.slice(0, 10)}…
                        </span>
                      )}
                      {event.execution?.transactionLink && (
                        <a
                          href={event.execution.transactionLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
                        >
                          Explorer <ExternalLink className="size-3" />
                        </a>
                      )}
                      <span className="ml-auto hidden font-mono sm:inline">
                        {event.correlationId.slice(0, 12)}
                      </span>
                    </div>

                    {event.execution?.errorMessage && (
                      <p className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                        {event.execution.errorMessage}
                      </p>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </>
  );
}
