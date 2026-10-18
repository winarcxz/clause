"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Bot,
  FileClock,
  Plus,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { formatUnits } from "viem";

import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";
import { PageSkeleton, QueryError } from "@/components/product/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-api";
import type { DashboardData } from "@/lib/product-types";

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  COMPLETED: "success",
  SUCCEEDED: "success",
  ACTIVE: "success",
  RUNNING: "warning",
  PENDING: "warning",
  FAILED: "danger",
  UNKNOWN: "danger",
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function metric(
  label: string,
  value: string,
  detail: string,
  Icon: typeof Activity,
) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <Icon className="size-4 text-[var(--muted-soft)]" />
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-[-0.035em]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>("/api/dashboard"),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) {
    return (
      <QueryError
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  }
  if (!query.data) return <PageSkeleton />;

  const data = query.data;
  const activeMandates = data.mandates.filter(
    (mandate) => mandate.status === "ACTIVE",
  ).length;
  const spend =
    data.spendThisMonth.length === 0
      ? "0"
      : data.spendThisMonth
          .map(
            (item) =>
              `${formatUnits(BigInt(item.baseUnits), item.decimals)} ${item.symbol}`,
          )
          .join(" · ");

  return (
    <>
      <PageHeader
        eyebrow="Control room"
        title="Execution overview"
        description="Monitor the mandates, agent sessions, and KeeperHub executions attached to your account."
        action={
          <Button asChild>
            <Link href="/chat">
              Ask the agent <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metric("Active mandates", String(activeMandates), "Enforcing policy", ShieldCheck)}
        {metric("Spend this month", spend, "Completed executions", Activity)}
        {metric("Agent sessions", String(data.activeChats), "Recorded conversations", Bot)}
        {metric(
          "Primary wallet",
          data.wallet ? shortAddress(data.wallet.address) : "Not linked",
          data.wallet?.chainId ? `Chain ${data.wallet.chainId}` : "Connect in Settings",
          WalletCards,
        )}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Current mandates</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/mandates/new">
                <Plus className="size-3.5" /> New
              </Link>
            </Button>
          </div>
          {data.mandates.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No mandate is active"
              description="Define the first set of boundaries before asking the agent to prepare an execution."
              action={
                <Button asChild size="sm">
                  <Link href="/mandates/new">Create mandate</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {data.mandates.map((mandate, index) => (
                <div
                  key={mandate.id}
                  className={`flex items-center justify-between gap-4 p-4 ${
                    index > 0 ? "border-t border-[var(--border)]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{mandate.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {mandate.accountingTokenSymbol} · {mandate.allowedChainIds.length} chain
                      {mandate.allowedChainIds.length === 1 ? "" : "s"} · Updated{" "}
                      {new Date(mandate.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge tone={statusTone[mandate.status] ?? "neutral"}>
                    {mandate.status.toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent executions</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/audit">
                Audit trail <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          {data.recentExecutions.length === 0 ? (
            <EmptyState
              icon={FileClock}
              title="No executions yet"
              description="Simulations and approved testnet transactions will appear here with their proof."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {data.recentExecutions.map((execution, index) => (
                <div
                  key={execution.id}
                  className={`flex items-center gap-3 p-4 ${
                    index > 0 ? "border-t border-[var(--border)]" : ""
                  }`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)]">
                    <Activity className="size-4 text-[var(--muted)]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {execution.proposal.explanation}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {new Date(execution.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={statusTone[execution.status] ?? "neutral"}>
                    {execution.status.toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
