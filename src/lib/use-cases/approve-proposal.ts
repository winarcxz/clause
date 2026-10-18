import type { SupportedAction } from "@/lib/domain/action";
import type {
  KeeperHubExecution,
  KeeperHubExecutionStatus,
} from "@/lib/providers/keeperhub";
import { ApplicationError } from "@/lib/use-cases/application-error";

export interface ApprovalClaim {
  proposalId: string;
  action: SupportedAction;
  idempotencyKey: string;
}

export interface ApprovalRepository {
  claimForExecution(
    userId: string,
    proposalId: string,
    now: Date,
  ): Promise<ApprovalClaim | null>;
  recordKeeperHubExecution(
    claim: ApprovalClaim,
    executionId: string,
  ): Promise<void>;
  recordExecutionStatus(
    claim: ApprovalClaim,
    status: KeeperHubExecutionStatus,
  ): Promise<void>;
  recordExecutionError(claim: ApprovalClaim, error: unknown): Promise<void>;
}

export interface ApprovalDependencies {
  repository: ApprovalRepository;
  keeperHub: {
    executeAction(
      action: SupportedAction,
      idempotencyKey: string,
    ): Promise<KeeperHubExecution>;
    getExecutionStatus(executionId: string): Promise<KeeperHubExecutionStatus>;
  };
  now?: () => Date;
}

export async function approveProposal(
  dependencies: ApprovalDependencies,
  input: { userId: string; proposalId: string },
): Promise<KeeperHubExecutionStatus> {
  const now = dependencies.now?.() ?? new Date();
  const claim = await dependencies.repository.claimForExecution(
    input.userId,
    input.proposalId,
    now,
  );

  if (!claim) {
    throw new ApplicationError(
      "PROPOSAL_NOT_APPROVABLE",
      "The proposal is missing, expired, changed, or already claimed",
      { status: 409 },
    );
  }

  try {
    const execution = await dependencies.keeperHub.executeAction(
      claim.action,
      claim.idempotencyKey,
    );
    await dependencies.repository.recordKeeperHubExecution(
      claim,
      execution.executionId,
    );

    const status = await dependencies.keeperHub.getExecutionStatus(
      execution.executionId,
    );
    await dependencies.repository.recordExecutionStatus(claim, status);
    return status;
  } catch (error) {
    await dependencies.repository.recordExecutionError(claim, error);
    throw error;
  }
}
