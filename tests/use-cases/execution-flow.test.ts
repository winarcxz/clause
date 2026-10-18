import type { SupportedAction } from "@/lib/domain/action";
import type {
  MandateSnapshot,
  SpendSnapshot,
} from "@/lib/domain/mandate";
import {
  hashCanonicalPayload,
  stableStringify,
} from "@/lib/use-cases/payload-integrity";
import {
  simulateProposal,
  type SimulationRepository,
} from "@/lib/use-cases/simulate-proposal";
import {
  approveProposal,
  type ApprovalRepository,
} from "@/lib/use-cases/approve-proposal";

const recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const action: SupportedAction = {
  type: "erc20_transfer",
  chainId: 11155111,
  amount: "1",
  recipient,
  tokenAddress: usdc,
  tokenSymbol: "USDC",
  tokenDecimals: 6,
  category: "payment",
};

const mandate: MandateSnapshot = {
  id: "mandate_1",
  name: "Payments",
  status: "ACTIVE",
  expiresAt: "2026-08-30T00:00:00.000Z",
  maxTransactionBaseUnits: "5000000",
  dailyLimitBaseUnits: "10000000",
  monthlyLimitBaseUnits: "100000000",
  accountingAsset: {
    kind: "erc20",
    chainId: 11155111,
    address: usdc,
    symbol: "USDC",
    decimals: 6,
  },
  allowedChainIds: [11155111],
  allowedTokens: [usdc],
  allowedRecipients: [recipient],
  allowedCategories: ["payment"],
  allowedContractAddresses: [],
  requireManualApproval: true,
};

const spend: SpendSnapshot = {
  todayBaseUnits: "0",
  monthBaseUnits: "0",
};

describe("payload integrity", () => {
  it("produces the same hash regardless of object key insertion order", () => {
    const first = { chainId: 11155111, amount: "1", nested: { b: 2, a: 1 } };
    const second = { nested: { a: 1, b: 2 }, amount: "1", chainId: 11155111 };

    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(hashCanonicalPayload(first)).toBe(hashCanonicalPayload(second));
  });
});

describe("simulateProposal", () => {
  it("rejects a policy failure without contacting KeeperHub", async () => {
    let providerCalls = 0;
    let rejectionRecorded = false;
    const repository: SimulationRepository = {
      getContext: async () => ({
        proposalId: "proposal_1",
        action,
        mandate: { ...mandate, allowedRecipients: [] },
        spend,
      }),
      recordRejection: async (_context, evaluation) => {
        rejectionRecorded = !evaluation.allowed;
      },
      recordSimulation: async () => {
        throw new Error("Simulation must not be stored");
      },
    };

    const result = await simulateProposal(
      {
        repository,
        keeperHub: {
          simulateAction: async () => {
            providerCalls += 1;
            throw new Error("KeeperHub must not be called");
          },
        },
        now: () => new Date("2026-07-30T12:00:00.000Z"),
      },
      { userId: "user_1", proposalId: "proposal_1" },
    );

    expect(result.status).toBe("REJECTED");
    expect(providerCalls).toBe(0);
    expect(rejectionRecorded).toBe(true);
  });

  it("stores the exact canonical payload and simulation proof", async () => {
    let storedHash = "";
    let storedPayload: Record<string, unknown> | undefined;
    const repository: SimulationRepository = {
      getContext: async () => ({
        proposalId: "proposal_1",
        action,
        mandate,
        spend,
      }),
      recordRejection: async () => {
        throw new Error("Valid proposal must not be rejected");
      },
      recordSimulation: async (input) => {
        storedHash = input.payloadHash;
        storedPayload = input.canonicalPayload;
      },
    };

    const result = await simulateProposal(
      {
        repository,
        keeperHub: {
          simulateAction: async () => ({
            success: true,
            status: "simulated",
            from: recipient,
            to: recipient,
            value: "0",
            gasEstimate: "65000",
            simulatedReturnValue: true,
            wouldRevert: false,
          }),
        },
        now: () => new Date("2026-07-30T12:00:00.000Z"),
      },
      { userId: "user_1", proposalId: "proposal_1" },
    );

    expect(result.status).toBe("SIMULATED");
    expect(storedPayload).toEqual({
      chainId: 11155111,
      recipientAddress: recipient,
      amount: "1",
      tokenAddress: usdc,
      gasLimitMultiplier: "1.2",
    });
    expect(storedHash).toBe(hashCanonicalPayload(storedPayload));
  });
});

describe("approveProposal", () => {
  it("claims once, broadcasts idempotently, then records authoritative status", async () => {
    const events: string[] = [];
    const repository: ApprovalRepository = {
      claimForExecution: async () => {
        events.push("claim");
        return {
          proposalId: "proposal_1",
          action,
          idempotencyKey: "proposal_1",
        };
      },
      recordKeeperHubExecution: async (_claim, executionId) => {
        events.push(`execution:${executionId}`);
      },
      recordExecutionStatus: async (_claim, status) => {
        events.push(`status:${status.status}`);
      },
      recordExecutionError: async () => {
        throw new Error("Successful execution must not record an error");
      },
    };

    const result = await approveProposal(
      {
        repository,
        keeperHub: {
          executeAction: async (_action, idempotencyKey) => {
            events.push(`broadcast:${idempotencyKey}`);
            return { executionId: "direct_123", status: "completed" };
          },
          getExecutionStatus: async (executionId) => {
            events.push(`poll:${executionId}`);
            return {
              executionId,
              status: "completed",
              transactionHash: "0xabc",
              transactionLink: "https://sepolia.etherscan.io/tx/0xabc",
              gasUsedWei: "21000",
              result: { success: true },
              error: null,
            };
          },
        },
        now: () => new Date("2026-07-30T12:00:00.000Z"),
      },
      { userId: "user_1", proposalId: "proposal_1" },
    );

    expect(result.status).toBe("completed");
    expect(events).toEqual([
      "claim",
      "broadcast:proposal_1",
      "execution:direct_123",
      "poll:direct_123",
      "status:completed",
    ]);
  });

  it("never broadcasts when the proposal cannot be claimed", async () => {
    let broadcasts = 0;
    const repository: ApprovalRepository = {
      claimForExecution: async () => null,
      recordKeeperHubExecution: async () => undefined,
      recordExecutionStatus: async () => undefined,
      recordExecutionError: async () => undefined,
    };

    await expect(
      approveProposal(
        {
          repository,
          keeperHub: {
            executeAction: async () => {
              broadcasts += 1;
              return { executionId: "impossible", status: "completed" };
            },
            getExecutionStatus: async () => ({
              executionId: "impossible",
              status: "completed",
            }),
          },
          now: () => new Date("2026-07-30T12:00:00.000Z"),
        },
        { userId: "user_1", proposalId: "proposal_1" },
      ),
    ).rejects.toMatchObject({ code: "PROPOSAL_NOT_APPROVABLE" });

    expect(broadcasts).toBe(0);
  });
});
