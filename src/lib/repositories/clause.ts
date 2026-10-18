import { getAddress, isAddressEqual, type Address } from "viem";

import {
  ActionType,
  AuditActor,
  AuditEventType,
  ExecutionStatus,
  Prisma,
  ProposalStatus,
  type Mandate,
} from "@/generated/prisma/client";
import {
  agentIntentSchema,
  supportedActionSchema,
  type AgentIntent,
  type SupportedAction,
} from "@/lib/domain/action";
import {
  evaluateMandate,
  type MandateEvaluation,
  type MandateSnapshot,
  type SpendSnapshot,
} from "@/lib/domain/mandate";
import { parseUnitsExact } from "@/lib/domain/money";
import { getDb } from "@/lib/db";
import type {
  ConversationMessage,
  GeneratedIntent,
} from "@/lib/providers/groq";
import {
  buildKeeperHubPayload,
  type KeeperHubExecutionStatus,
} from "@/lib/providers/keeperhub";
import { ProviderError } from "@/lib/providers/provider-error";
import type {
  ApprovalClaim,
  ApprovalRepository,
} from "@/lib/use-cases/approve-proposal";
import { hashCanonicalPayload } from "@/lib/use-cases/payload-integrity";
import type {
  SimulationContext,
  SimulationRepository,
  StoredSimulation,
} from "@/lib/use-cases/simulate-proposal";
import type { MandateInput } from "@/lib/schemas/mandate";
import { toMandatePersistence } from "@/lib/schemas/mandate";

type DbClient = ReturnType<typeof getDb>;
type TransactionClient = Parameters<
  Parameters<DbClient["$transaction"]>[0]
>[0];

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sameAddress(left: string, right: string): boolean {
  try {
    return isAddressEqual(getAddress(left), getAddress(right));
  } catch {
    return false;
  }
}

export function mandateToSnapshot(mandate: Mandate): MandateSnapshot {
  const common = {
    id: mandate.id,
    name: mandate.name,
    status: mandate.status,
    expiresAt: mandate.expiresAt?.toISOString() ?? null,
    maxTransactionBaseUnits: mandate.maxTransactionBaseUnits,
    dailyLimitBaseUnits: mandate.dailyLimitBaseUnits,
    monthlyLimitBaseUnits: mandate.monthlyLimitBaseUnits,
    allowedChainIds: mandate.allowedChainIds,
    allowedTokens: mandate.allowedTokens,
    allowedRecipients: mandate.allowedRecipients.map((address) =>
      getAddress(address),
    ),
    allowedCategories: mandate.allowedCategories,
    allowedContractAddresses: mandate.allowedContractAddresses.map((address) =>
      getAddress(address),
    ),
    requireManualApproval: mandate.requireManualApproval,
  } satisfies Omit<MandateSnapshot, "accountingAsset">;

  if (mandate.accountingAssetKind === "NATIVE") {
    return {
      ...common,
      accountingAsset: {
        kind: "native",
        chainId: mandate.accountingChainId,
        address: null,
        symbol: mandate.accountingTokenSymbol,
        decimals: mandate.accountingTokenDecimals,
      },
    };
  }

  if (!mandate.accountingTokenAddress) {
    throw new Error("ERC-20 mandate is missing its accounting token address");
  }

  return {
    ...common,
    accountingAsset: {
      kind: "erc20",
      chainId: mandate.accountingChainId,
      address: getAddress(mandate.accountingTokenAddress),
      symbol: mandate.accountingTokenSymbol,
      decimals: mandate.accountingTokenDecimals,
    },
  };
}

function actionAmountForMandate(
  action: SupportedAction,
  mandate: MandateSnapshot,
): bigint | null {
  if (action.chainId !== mandate.accountingAsset.chainId) {
    return null;
  }

  if (mandate.accountingAsset.kind === "native") {
    if (action.type === "erc20_transfer") {
      return null;
    }
    return parseUnitsExact(
      action.type === "contract_call" ? action.value : action.amount,
      mandate.accountingAsset.decimals,
    );
  }

  if (
    action.type !== "erc20_transfer" ||
    !sameAddress(action.tokenAddress, mandate.accountingAsset.address)
  ) {
    return null;
  }

  return parseUnitsExact(action.amount, mandate.accountingAsset.decimals);
}

function utcPeriodStarts(now: Date): { day: Date; month: Date } {
  return {
    day: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  };
}

async function calculateSpend(
  client: TransactionClient | DbClient,
  userId: string,
  mandate: MandateSnapshot,
  now: Date,
): Promise<SpendSnapshot> {
  const starts = utcPeriodStarts(now);
  const rows = await client.execution.findMany({
    where: {
      userId,
      status: ExecutionStatus.COMPLETED,
      completedAt: { gte: starts.month },
      proposal: { mandateId: mandate.id },
    },
    select: {
      completedAt: true,
      proposal: { select: { actionJson: true } },
    },
  });

  let today = 0n;
  let month = 0n;
  for (const row of rows) {
    const parsed = supportedActionSchema.safeParse(row.proposal.actionJson);
    if (!parsed.success) {
      continue;
    }
    const amount = actionAmountForMandate(parsed.data, mandate);
    if (amount === null) {
      continue;
    }
    month += amount;
    if (row.completedAt && row.completedAt >= starts.day) {
      today += amount;
    }
  }

  return {
    todayBaseUnits: today.toString(),
    monthBaseUnits: month.toString(),
  };
}

function checkCreates(evaluation: MandateEvaluation) {
  return evaluation.checks.map((item) => ({
    code: item.code,
    label: item.label,
    passed: item.passed,
    detail: item.detail,
    evidence: asJson(item.evidence),
  }));
}

function actionTypeFor(intent: AgentIntent): ActionType {
  if (intent.kind !== "action" || !intent.action) {
    return ActionType.UNSUPPORTED;
  }
  switch (intent.action.type) {
    case "native_transfer":
      return ActionType.NATIVE_TRANSFER;
    case "erc20_transfer":
      return ActionType.ERC20_TRANSFER;
    case "contract_call":
      return ActionType.CONTRACT_CALL;
  }
}

export interface PreparedConversation {
  chatId: string;
  history: ConversationMessage[];
  mandate: MandateSnapshot | null;
  aiPaused: boolean;
}

export class ClauseRepository
  implements SimulationRepository, ApprovalRepository
{
  constructor(private readonly db: DbClient = getDb()) {}

  async prepareConversation(
    userId: string,
    chatId: string | undefined,
    message: string,
  ): Promise<PreparedConversation> {
    const [settings, existingChat] = await Promise.all([
      this.db.settings.findUnique({ where: { userId } }),
      chatId
        ? this.db.chat.findFirst({ where: { id: chatId, userId } })
        : Promise.resolve(null),
    ]);

    const chat =
      existingChat ??
      (await this.db.chat.create({
        data: {
          userId,
          title: message.trim().slice(0, 64) || "New conversation",
        },
      }));

    const [messages, mandate] = await Promise.all([
      this.db.message.findMany({
        where: { chatId: chat.id },
        orderBy: { createdAt: "desc" },
        take: 16,
        select: { role: true, content: true },
      }),
      this.db.mandate.findFirst({
        where: {
          id: settings?.defaultMandateId ?? undefined,
          userId,
          status: "ACTIVE",
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const fallbackMandate =
      mandate ??
      (await this.db.mandate.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      }));

    return {
      chatId: chat.id,
      history: messages
        .reverse()
        .filter(
          (item): item is typeof item & { role: "USER" | "ASSISTANT" } =>
            item.role === "USER" || item.role === "ASSISTANT",
        )
        .map((item) => ({
          role: item.role === "USER" ? "user" : "assistant",
          content: item.content,
        })),
      mandate: fallbackMandate ? mandateToSnapshot(fallbackMandate) : null,
      aiPaused: settings?.aiPaused ?? false,
    };
  }

  async recordIntent(input: {
    userId: string;
    chatId: string;
    userMessage: string;
    generated: GeneratedIntent;
    mandateId: string | null;
  }) {
    const intent = agentIntentSchema.parse(input.generated.intent);

    return this.db.$transaction(async (transaction) => {
      await transaction.message.create({
        data: {
          chatId: input.chatId,
          role: "USER",
          content: input.userMessage,
        },
      });
      const assistantMessage = await transaction.message.create({
        data: {
          chatId: input.chatId,
          role: "ASSISTANT",
          content: intent.message,
          providerModel: input.generated.model,
          providerRequestId: input.generated.providerRequestId,
        },
      });
      const proposal = await transaction.actionProposal.create({
        data: {
          userId: input.userId,
          chatId: input.chatId,
          mandateId: input.mandateId,
          assistantMessageId: assistantMessage.id,
          actionType: actionTypeFor(intent),
          status:
            intent.kind === "unsupported"
              ? ProposalStatus.REJECTED
              : ProposalStatus.PROPOSED,
          actionJson: intent.action ? asJson(intent.action) : Prisma.JsonNull,
          explanation: intent.message,
          unsupportedAction: intent.unsupportedAction,
          auditEvents: {
            create: {
              userId: input.userId,
              type:
                intent.kind === "unsupported"
                  ? AuditEventType.INTENT_UNSUPPORTED
                  : AuditEventType.INTENT_CREATED,
              actor: AuditActor.AI,
              correlationId: input.generated.providerRequestId,
              metadata: asJson({
                kind: intent.kind,
                model: input.generated.model,
              }),
            },
          },
        },
        include: { checks: true, simulation: true, execution: true },
      });

      return { proposal, assistantMessage };
    });
  }

  async getContext(
    userId: string,
    proposalId: string,
  ): Promise<SimulationContext | null> {
    const proposal = await this.db.actionProposal.findFirst({
      where: {
        id: proposalId,
        userId,
        status: ProposalStatus.PROPOSED,
      },
      include: { mandate: true },
    });
    if (!proposal?.mandate || !proposal.actionJson) {
      return null;
    }

    const action = supportedActionSchema.safeParse(proposal.actionJson);
    if (!action.success) {
      return null;
    }
    const mandate = mandateToSnapshot(proposal.mandate);
    const spend = await calculateSpend(this.db, userId, mandate, new Date());

    return { proposalId, action: action.data, mandate, spend };
  }

  async recordRejection(
    context: SimulationContext,
    evaluation: MandateEvaluation,
  ): Promise<void> {
    await this.db.$transaction(async (transaction) => {
      await transaction.mandateCheck.deleteMany({
        where: { proposalId: context.proposalId },
      });
      await transaction.actionProposal.update({
        where: { id: context.proposalId },
        data: {
          status: ProposalStatus.REJECTED,
          mandateSnapshot: asJson(context.mandate),
          checks: { create: checkCreates(evaluation) },
          auditEvents: {
            create: {
              userId: await this.proposalUserId(transaction, context.proposalId),
              type: AuditEventType.VALIDATION_FAILED,
              actor: AuditActor.SYSTEM,
              correlationId: context.proposalId,
              metadata: asJson({ failedChecks: evaluation.checks.filter((item) => !item.passed) }),
            },
          },
        },
      });
    });
  }

  async recordSimulation(input: StoredSimulation): Promise<void> {
    const userId = await this.proposalUserId(this.db, input.context.proposalId);
    await this.db.$transaction(async (transaction) => {
      await transaction.mandateCheck.deleteMany({
        where: { proposalId: input.context.proposalId },
      });
      await transaction.actionProposal.update({
        where: { id: input.context.proposalId },
        data: {
          status: ProposalStatus.SIMULATED,
          mandateSnapshot: asJson(input.context.mandate),
          canonicalPayload: asJson(input.canonicalPayload),
          payloadHash: input.payloadHash,
          approvalExpiresAt: input.approvalExpiresAt,
          checks: { create: checkCreates(input.evaluation) },
        },
      });
      await transaction.simulation.upsert({
        where: { proposalId: input.context.proposalId },
        create: {
          proposalId: input.context.proposalId,
          requestPayload: asJson(input.canonicalPayload),
          responsePayload: asJson(input.simulation),
          requestHash: input.payloadHash,
          fromAddress: input.simulation.from,
          targetAddress: input.simulation.to,
          valueWei: input.simulation.value,
          gasEstimate: input.simulation.gasEstimate,
          simulatedReturnValue:
            input.simulation.simulatedReturnValue === undefined
              ? Prisma.JsonNull
              : asJson(input.simulation.simulatedReturnValue),
          wouldRevert: input.simulation.wouldRevert,
        },
        update: {
          responsePayload: asJson(input.simulation),
          gasEstimate: input.simulation.gasEstimate,
          simulatedReturnValue:
            input.simulation.simulatedReturnValue === undefined
              ? Prisma.JsonNull
              : asJson(input.simulation.simulatedReturnValue),
          wouldRevert: input.simulation.wouldRevert,
        },
      });
      await transaction.auditEvent.createMany({
        data: [
          {
            userId,
            proposalId: input.context.proposalId,
            type: AuditEventType.VALIDATION_PASSED,
            actor: AuditActor.SYSTEM,
            correlationId: input.context.proposalId,
            metadata: asJson({ checkCount: input.evaluation.checks.length }),
          },
          {
            userId,
            proposalId: input.context.proposalId,
            type: AuditEventType.SIMULATION_SUCCEEDED,
            actor: AuditActor.KEEPERHUB,
            correlationId: input.context.proposalId,
            metadata: asJson({
              gasEstimate: input.simulation.gasEstimate,
              requestHash: input.payloadHash,
            }),
          },
        ],
      });
    });
  }

  async claimForExecution(
    userId: string,
    proposalId: string,
    now: Date,
  ): Promise<ApprovalClaim | null> {
    return this.db.$transaction(
      async (transaction) => {
        const proposal = await transaction.actionProposal.findFirst({
          where: {
            id: proposalId,
            userId,
            status: ProposalStatus.SIMULATED,
            approvalExpiresAt: { gt: now },
          },
          include: { mandate: true, simulation: true },
        });
        if (
          !proposal?.mandate ||
          !proposal.simulation ||
          !proposal.actionJson ||
          !proposal.canonicalPayload ||
          !proposal.payloadHash
        ) {
          return null;
        }

        const action = supportedActionSchema.safeParse(proposal.actionJson);
        if (!action.success) {
          return null;
        }
        const canonicalPayload = buildKeeperHubPayload(action.data);
        const payloadHash = hashCanonicalPayload(canonicalPayload);
        if (
          payloadHash !== proposal.payloadHash ||
          payloadHash !== proposal.simulation.requestHash
        ) {
          return null;
        }

        const mandate = mandateToSnapshot(proposal.mandate);
        const spend = await calculateSpend(transaction, userId, mandate, now);
        const evaluation = evaluateMandate(action.data, mandate, spend, now);
        if (!evaluation.allowed) {
          await transaction.actionProposal.update({
            where: { id: proposalId },
            data: {
              status: ProposalStatus.REJECTED,
              checks: {
                deleteMany: {},
                create: checkCreates(evaluation),
              },
            },
          });
          await transaction.auditEvent.create({
            data: {
              userId,
              proposalId,
              type: AuditEventType.VALIDATION_FAILED,
              actor: AuditActor.SYSTEM,
              correlationId: proposalId,
              metadata: asJson({ stage: "approval_revalidation" }),
            },
          });
          return null;
        }

        const claimed = await transaction.actionProposal.updateMany({
          where: {
            id: proposalId,
            userId,
            status: ProposalStatus.SIMULATED,
            approvalExpiresAt: { gt: now },
          },
          data: {
            status: ProposalStatus.EXECUTING,
            approvedAt: now,
          },
        });
        if (claimed.count !== 1) {
          return null;
        }

        const execution = await transaction.execution.create({
          data: {
            userId,
            proposalId,
            idempotencyKey: proposalId,
            status: ExecutionStatus.PENDING,
            startedAt: now,
          },
        });
        await transaction.auditEvent.createMany({
          data: [
            {
              userId,
              proposalId,
              executionId: execution.id,
              type: AuditEventType.APPROVED,
              actor: AuditActor.USER,
              correlationId: proposalId,
              metadata: asJson({ requestHash: payloadHash }),
            },
            {
              userId,
              proposalId,
              executionId: execution.id,
              type: AuditEventType.EXECUTION_STARTED,
              actor: AuditActor.SYSTEM,
              correlationId: proposalId,
              metadata: asJson({ idempotencyKey: proposalId }),
            },
          ],
        });

        return {
          proposalId,
          action: action.data,
          idempotencyKey: proposalId,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }

  async recordKeeperHubExecution(
    claim: ApprovalClaim,
    executionId: string,
  ): Promise<void> {
    await this.db.execution.update({
      where: { proposalId: claim.proposalId },
      data: {
        keeperHubExecutionId: executionId,
        status: ExecutionStatus.RUNNING,
      },
    });
  }

  async recordExecutionStatus(
    claim: ApprovalClaim,
    status: KeeperHubExecutionStatus,
  ): Promise<void> {
    const terminal = status.status === "completed" || status.status === "failed";
    const successful = status.status === "completed";
    const execution = await this.db.execution.findUniqueOrThrow({
      where: { proposalId: claim.proposalId },
      select: { id: true, userId: true },
    });

    await this.db.$transaction([
      this.db.execution.update({
        where: { proposalId: claim.proposalId },
        data: {
          status: successful
            ? ExecutionStatus.COMPLETED
            : status.status === "failed"
              ? ExecutionStatus.FAILED
              : ExecutionStatus.RUNNING,
          transactionHash: status.transactionHash ?? null,
          transactionLink: status.transactionLink ?? null,
          gasUsedWei: status.gasUsedWei ?? null,
          resultJson:
            status.result === undefined ? Prisma.JsonNull : asJson(status.result),
          errorMessage: status.error ?? null,
          completedAt: terminal ? new Date() : null,
        },
      }),
      this.db.actionProposal.update({
        where: { id: claim.proposalId },
        data: {
          status: successful
            ? ProposalStatus.SUCCEEDED
            : status.status === "failed"
              ? ProposalStatus.FAILED
              : ProposalStatus.EXECUTING,
        },
      }),
      ...(terminal
        ? [
            this.db.auditEvent.create({
              data: {
                userId: execution.userId,
                proposalId: claim.proposalId,
                executionId: execution.id,
                type: successful
                  ? AuditEventType.EXECUTION_SUCCEEDED
                  : AuditEventType.EXECUTION_FAILED,
                actor: AuditActor.KEEPERHUB,
                correlationId: claim.proposalId,
                metadata: asJson({
                  keeperHubExecutionId: status.executionId,
                  transactionHash: status.transactionHash ?? null,
                  gasUsedWei: status.gasUsedWei ?? null,
                }),
              },
            }),
          ]
        : []),
    ]);
  }

  async recordExecutionError(
    claim: ApprovalClaim,
    error: unknown,
  ): Promise<void> {
    const execution = await this.db.execution.findUniqueOrThrow({
      where: { proposalId: claim.proposalId },
    });
    const uncertain =
      error instanceof ProviderError &&
      (error.code === "KEEPERHUB_UNAVAILABLE" ||
        error.code === "KEEPERHUB_INVALID_RESPONSE");

    await this.db.$transaction([
      this.db.execution.update({
        where: { id: execution.id },
        data: {
          status: uncertain ? ExecutionStatus.UNKNOWN : ExecutionStatus.FAILED,
          errorCode:
            error instanceof ProviderError ? error.code : "EXECUTION_ERROR",
          errorMessage:
            error instanceof Error ? error.message : "Unknown execution error",
          completedAt: uncertain ? null : new Date(),
        },
      }),
      this.db.actionProposal.update({
        where: { id: claim.proposalId },
        data: {
          status: uncertain
            ? ProposalStatus.EXECUTING
            : ProposalStatus.FAILED,
        },
      }),
      this.db.auditEvent.create({
        data: {
          userId: execution.userId,
          proposalId: claim.proposalId,
          executionId: execution.id,
          type: uncertain
            ? AuditEventType.EXECUTION_RECONCILED
            : AuditEventType.EXECUTION_FAILED,
          actor: AuditActor.SYSTEM,
          correlationId: claim.proposalId,
          metadata: asJson({
            outcomeKnown: !uncertain,
            code:
              error instanceof ProviderError ? error.code : "EXECUTION_ERROR",
          }),
        },
      }),
    ]);
  }

  async cancelProposal(userId: string, proposalId: string): Promise<boolean> {
    const cancelled = await this.db.actionProposal.updateMany({
      where: {
        id: proposalId,
        userId,
        status: {
          in: [
            ProposalStatus.PROPOSED,
            ProposalStatus.VALIDATED,
            ProposalStatus.SIMULATED,
          ],
        },
      },
      data: {
        status: ProposalStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    if (cancelled.count === 1) {
      await this.db.auditEvent.create({
        data: {
          userId,
          proposalId,
          type: AuditEventType.CANCELLED,
          actor: AuditActor.USER,
          correlationId: proposalId,
          metadata: {},
        },
      });
    }
    return cancelled.count === 1;
  }

  async getExecutionForUser(userId: string, executionId: string) {
    return this.db.execution.findFirst({
      where: {
        userId,
        OR: [{ id: executionId }, { keeperHubExecutionId: executionId }],
      },
      include: {
        proposal: {
          include: { checks: true, simulation: true },
        },
      },
    });
  }

  async getProposalForUser(userId: string, proposalId: string) {
    return this.db.actionProposal.findFirst({
      where: { id: proposalId, userId },
      include: {
        checks: { orderBy: { createdAt: "asc" } },
        simulation: true,
        execution: true,
        mandate: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async listMandates(userId: string) {
    return this.db.mandate.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { proposals: true } },
      },
    });
  }

  async createMandate(userId: string, input: MandateInput) {
    const data = toMandatePersistence(input);
    return this.db.$transaction(async (transaction) => {
      const mandate = await transaction.mandate.create({
        data: { userId, ...data },
      });
      if (mandate.status === "ACTIVE") {
        await transaction.settings.upsert({
          where: { userId },
          create: { userId, defaultMandateId: mandate.id },
          update: { defaultMandateId: mandate.id },
        });
      }
      await transaction.auditEvent.create({
        data: {
          userId,
          type: AuditEventType.MANDATE_CREATED,
          actor: AuditActor.USER,
          correlationId: mandate.id,
          metadata: asJson({
            mandateId: mandate.id,
            name: mandate.name,
            status: mandate.status,
          }),
        },
      });
      return mandate;
    });
  }

  async getDashboard(userId: string) {
    const monthStart = utcPeriodStarts(new Date()).month;
    const [mandates, recentExecutions, chatCount, completedThisMonth, wallet] =
      await Promise.all([
        this.db.mandate.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
        }),
        this.db.execution.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            proposal: {
              select: {
                explanation: true,
                actionType: true,
                actionJson: true,
              },
            },
          },
        }),
        this.db.chat.count({ where: { userId } }),
        this.db.execution.findMany({
          where: {
            userId,
            status: ExecutionStatus.COMPLETED,
            completedAt: { gte: monthStart },
          },
          select: { proposal: { select: { actionJson: true } } },
        }),
        this.db.wallet.findFirst({
          where: { userId, isPrimary: true },
        }),
      ]);

    const spendByAsset = new Map<string, bigint>();
    for (const execution of completedThisMonth) {
      const parsed = supportedActionSchema.safeParse(
        execution.proposal.actionJson,
      );
      if (!parsed.success || parsed.data.type === "contract_call") {
        continue;
      }
      const key = `${parsed.data.chainId}:${parsed.data.tokenSymbol}:${parsed.data.tokenDecimals}`;
      const amount = parseUnitsExact(
        parsed.data.amount,
        parsed.data.tokenDecimals,
      );
      spendByAsset.set(key, (spendByAsset.get(key) ?? 0n) + amount);
    }

    return {
      mandates,
      recentExecutions,
      activeChats: chatCount,
      wallet,
      spendThisMonth: Array.from(spendByAsset, ([key, baseUnits]) => {
        const [chainId, symbol, decimals] = key.split(":");
        return {
          chainId: Number(chainId),
          symbol,
          decimals: Number(decimals),
          baseUnits: baseUnits.toString(),
        };
      }),
    };
  }

  async listChats(userId: string) {
    return this.db.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
        proposals: {
          orderBy: { createdAt: "asc" },
          include: { checks: true, simulation: true, execution: true },
        },
      },
    });
  }

  async listAudit(userId: string, take = 80) {
    return this.db.auditEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 200),
      include: {
        proposal: {
          select: {
            id: true,
            explanation: true,
            actionType: true,
            status: true,
          },
        },
        execution: {
          select: {
            id: true,
            keeperHubExecutionId: true,
            status: true,
            transactionHash: true,
            transactionLink: true,
            gasUsedWei: true,
            errorMessage: true,
          },
        },
      },
    });
  }

  async getSettings(userId: string) {
    const [settings, wallet] = await Promise.all([
      this.db.settings.upsert({
        where: { userId },
        create: { userId },
        update: {},
      }),
      this.db.wallet.findFirst({ where: { userId, isPrimary: true } }),
    ]);
    return { settings, wallet };
  }

  async updateSettings(
    userId: string,
    input: {
      aiPaused?: boolean;
      theme?: "light" | "dark" | "system";
      preferredChainId?: number | null;
      wallet?: { address: Address; chainId: number | null } | null;
    },
  ) {
    const previous = await this.db.settings.findUnique({ where: { userId } });
    return this.db.$transaction(async (transaction) => {
      const settings = await transaction.settings.upsert({
        where: { userId },
        create: {
          userId,
          aiPaused: input.aiPaused,
          theme: input.theme,
          preferredChainId: input.preferredChainId,
        },
        update: {
          aiPaused: input.aiPaused,
          theme: input.theme,
          preferredChainId: input.preferredChainId,
        },
      });
      if (input.wallet) {
        await transaction.wallet.updateMany({
          where: { userId },
          data: { isPrimary: false },
        });
        await transaction.wallet.upsert({
          where: {
            userId_address: {
              userId,
              address: getAddress(input.wallet.address),
            },
          },
          create: {
            userId,
            address: getAddress(input.wallet.address),
            chainId: input.wallet.chainId,
            isPrimary: true,
          },
          update: {
            chainId: input.wallet.chainId,
            isPrimary: true,
          },
        });
      }
      if (
        input.aiPaused !== undefined &&
        input.aiPaused !== previous?.aiPaused
      ) {
        await transaction.auditEvent.create({
          data: {
            userId,
            type: input.aiPaused
              ? AuditEventType.AI_PAUSED
              : AuditEventType.AI_RESUMED,
            actor: AuditActor.USER,
            correlationId: crypto.randomUUID(),
            metadata: {},
          },
        });
      }
      return settings;
    });
  }

  private async proposalUserId(
    client: TransactionClient | DbClient,
    proposalId: string,
  ): Promise<string> {
    const proposal = await client.actionProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: { userId: true },
    });
    return proposal.userId;
  }
}
