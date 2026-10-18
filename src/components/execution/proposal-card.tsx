"use client";

import {
  ArrowRight,
  Check,
  CircleDashed,
  ExternalLink,
  ShieldAlert,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ProposalView {
  id: string;
  assistantMessageId?: string | null;
  status: string;
  actionType: string;
  actionJson: Record<string, unknown> | null;
  explanation: string;
  checks: Array<{
    id?: string;
    code: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
  simulation: {
    gasEstimate: string;
    wouldRevert: boolean;
    fromAddress: string;
    targetAddress: string;
  } | null;
  execution: {
    status: string;
    transactionHash?: string | null;
    transactionLink?: string | null;
    gasUsedWei?: string | null;
  } | null;
}

function actionSummary(proposal: ProposalView) {
  const action = proposal.actionJson;
  if (!action) {
    return { amount: "Unsupported action", target: "Not executable", network: "—" };
  }
  const amount =
    typeof action.amount === "string"
      ? `${action.amount} ${String(action.tokenSymbol ?? "")}`.trim()
      : action.type === "contract_call"
        ? String(action.functionName ?? "Contract call")
        : "Action";
  const target = String(action.recipient ?? action.contractAddress ?? "—");
  return { amount, target, network: String(action.chainId ?? "—") };
}

export function ProposalCard({
  proposal,
  onSimulate,
  onApprove,
  onCancel,
  pendingAction,
}: {
  proposal: ProposalView;
  onSimulate: () => void | Promise<void>;
  onApprove: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  pendingAction: "simulate" | "approve" | "cancel" | null;
}) {
  const unsupported = proposal.actionType === "UNSUPPORTED";
  const summary = actionSummary(proposal);
  const checksPassed =
    proposal.checks.length > 0 && proposal.checks.every((item) => item.passed);
  const canApprove =
    proposal.status === "SIMULATED" &&
    proposal.simulation !== null &&
    !proposal.simulation.wouldRevert &&
    checksPassed;
  const canSimulate = proposal.status === "PROPOSED" && !unsupported;
  const terminal = ["REJECTED", "CANCELLED", "EXPIRED", "SUCCEEDED", "FAILED"].includes(
    proposal.status,
  );

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            {unsupported ? (
              <ShieldAlert className="size-4" />
            ) : (
              <CircleDashed className="size-4" />
            )}
          </span>
          <span className="text-sm font-semibold">Execution proposal</span>
        </div>
        <Badge>{proposal.status.toLowerCase().replaceAll("_", " ")}</Badge>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-[11px] font-medium tracking-[0.07em] text-[var(--muted)] uppercase">
            Action
          </p>
          <p className="mt-1 text-sm font-semibold">{summary.amount}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Chain {summary.network}
          </p>
        </div>
        <ArrowRight className="hidden size-4 text-[var(--muted-soft)] sm:block" />
        <div className="min-w-0 sm:text-right">
          <p className="text-[11px] font-medium tracking-[0.07em] text-[var(--muted)] uppercase">
            Recipient / target
          </p>
          <p className="mt-1 truncate font-mono text-xs">{summary.target}</p>
          {proposal.simulation && (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {proposal.simulation.gasEstimate} gas units
            </p>
          )}
        </div>
      </div>

      {proposal.checks.length > 0 && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <p className="mb-2 text-[11px] font-medium tracking-[0.07em] text-[var(--muted)] uppercase">
            Mandate checks
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {proposal.checks.map((item) => (
              <div
                key={item.code}
                className="flex items-start gap-2 rounded-lg bg-[var(--surface-subtle)] px-2.5 py-2"
              >
                {item.passed ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0 text-[var(--danger)]" />
                )}
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {proposal.execution?.transactionLink && (
        <a
          href={proposal.execution.transactionLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          View transaction proof <ExternalLink className="size-3.5" />
        </a>
      )}

      {!unsupported && !terminal && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={pendingAction !== null}
          >
            Cancel
          </Button>
          {canSimulate && (
            <Button
              size="sm"
              onClick={onSimulate}
              disabled={pendingAction !== null}
            >
              {pendingAction === "simulate" ? "Simulating…" : "Simulate transaction"}
            </Button>
          )}
          {(proposal.status === "SIMULATED" || pendingAction === "approve") && (
            <Button
              size="sm"
              aria-label="Approve execution"
              onClick={onApprove}
              disabled={!canApprove || pendingAction !== null}
            >
              {pendingAction === "approve" ? "Executing…" : "Approve execution"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
