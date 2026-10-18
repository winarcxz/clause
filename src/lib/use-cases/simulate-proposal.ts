import type { SupportedAction } from "@/lib/domain/action";
import {
  evaluateMandate,
  type MandateEvaluation,
  type MandateSnapshot,
  type SpendSnapshot,
} from "@/lib/domain/mandate";
import {
  buildKeeperHubPayload,
  type KeeperHubSimulation,
} from "@/lib/providers/keeperhub";
import { ApplicationError } from "@/lib/use-cases/application-error";
import { hashCanonicalPayload } from "@/lib/use-cases/payload-integrity";

export interface SimulationContext {
  proposalId: string;
  action: SupportedAction;
  mandate: MandateSnapshot;
  spend: SpendSnapshot;
}

export interface StoredSimulation {
  context: SimulationContext;
  evaluation: MandateEvaluation;
  canonicalPayload: Record<string, unknown>;
  payloadHash: string;
  simulation: KeeperHubSimulation;
  approvalExpiresAt: Date;
}

export interface SimulationRepository {
  getContext(
    userId: string,
    proposalId: string,
  ): Promise<SimulationContext | null>;
  recordRejection(
    context: SimulationContext,
    evaluation: MandateEvaluation,
  ): Promise<void>;
  recordSimulation(input: StoredSimulation): Promise<void>;
}

export interface SimulationDependencies {
  repository: SimulationRepository;
  keeperHub: {
    simulateAction(action: SupportedAction): Promise<KeeperHubSimulation>;
  };
  now?: () => Date;
}

export async function simulateProposal(
  dependencies: SimulationDependencies,
  input: { userId: string; proposalId: string },
) {
  const now = dependencies.now?.() ?? new Date();
  const context = await dependencies.repository.getContext(
    input.userId,
    input.proposalId,
  );

  if (!context) {
    throw new ApplicationError("PROPOSAL_NOT_FOUND", "Proposal not found", {
      status: 404,
    });
  }

  const evaluation = evaluateMandate(
    context.action,
    context.mandate,
    context.spend,
    now,
  );

  if (!evaluation.allowed) {
    await dependencies.repository.recordRejection(context, evaluation);
    return { status: "REJECTED" as const, evaluation };
  }

  const canonicalPayload = buildKeeperHubPayload(
    context.action,
  ) as Record<string, unknown>;
  const payloadHash = hashCanonicalPayload(canonicalPayload);
  const simulation = await dependencies.keeperHub.simulateAction(context.action);

  if (simulation.wouldRevert) {
    throw new ApplicationError(
      "SIMULATION_WOULD_REVERT",
      "KeeperHub simulation indicates this transaction would revert",
      { status: 422 },
    );
  }

  const approvalExpiresAt = new Date(now.getTime() + 10 * 60 * 1_000);
  await dependencies.repository.recordSimulation({
    context,
    evaluation,
    canonicalPayload,
    payloadHash,
    simulation,
    approvalExpiresAt,
  });

  return {
    status: "SIMULATED" as const,
    evaluation,
    simulation,
    payloadHash,
    approvalExpiresAt,
  };
}
