import type { SupportedAction } from "@/lib/domain/action";
import {
  evaluateMandate,
  type MandateSnapshot,
  type SpendSnapshot,
} from "@/lib/domain/mandate";

const recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const secondRecipient = "0x53d284357ec70cE289D6D64134DfAc8E511c8a3D";
const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const action: SupportedAction = {
  type: "erc20_transfer",
  chainId: 11155111,
  amount: "5",
  recipient,
  tokenAddress: usdc,
  tokenSymbol: "USDC",
  tokenDecimals: 6,
  category: "payment",
};

const mandate: MandateSnapshot = {
  id: "mandate_1",
  name: "Operations",
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
  todayBaseUnits: "5000000",
  monthBaseUnits: "50000000",
};

describe("evaluateMandate", () => {
  it("accepts an action exactly at the transaction and daily boundaries", () => {
    const result = evaluateMandate(
      action,
      mandate,
      spend,
      new Date("2026-07-30T12:00:00.000Z"),
    );

    expect(result.allowed).toBe(true);
    expect(result.requiresManualApproval).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("rejects an action one base unit above the transaction limit", () => {
    const result = evaluateMandate(
      { ...action, amount: "5.000001" },
      mandate,
      { ...spend, todayBaseUnits: "0" },
      new Date("2026-07-30T12:00:00.000Z"),
    );

    expect(result.allowed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        code: "TRANSACTION_LIMIT",
        passed: false,
      }),
    );
  });

  it("rejects an expired mandate", () => {
    const result = evaluateMandate(
      action,
      mandate,
      spend,
      new Date("2026-09-01T00:00:00.000Z"),
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        code: "MANDATE_NOT_EXPIRED",
        passed: false,
      }),
    );
  });

  it("rejects a recipient outside the allowlist", () => {
    const result = evaluateMandate(
      { ...action, recipient: secondRecipient },
      mandate,
      spend,
      new Date("2026-07-30T12:00:00.000Z"),
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        code: "RECIPIENT_ALLOWED",
        passed: false,
      }),
    );
  });

  it("rejects spending in a different accounting asset", () => {
    const result = evaluateMandate(
      {
        type: "native_transfer",
        chainId: 11155111,
        amount: "0.01",
        recipient,
        tokenSymbol: "ETH",
        tokenDecimals: 18,
        category: "payment",
      },
      mandate,
      spend,
      new Date("2026-07-30T12:00:00.000Z"),
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        code: "ACCOUNTING_ASSET_MATCH",
        passed: false,
      }),
    );
  });

  it("requires a contract call target to be explicitly allowlisted", () => {
    const result = evaluateMandate(
      {
        type: "contract_call",
        chainId: 11155111,
        contractAddress: secondRecipient,
        functionName: "approve",
        functionArgs: [recipient, "1"],
        value: "0",
        category: "contract",
      },
      {
        ...mandate,
        accountingAsset: {
          kind: "native",
          chainId: 11155111,
          address: null,
          symbol: "ETH",
          decimals: 18,
        },
        allowedTokens: ["native"],
        allowedRecipients: [],
        allowedCategories: ["contract"],
      },
      { todayBaseUnits: "0", monthBaseUnits: "0" },
      new Date("2026-07-30T12:00:00.000Z"),
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        code: "CONTRACT_ALLOWED",
        passed: false,
      }),
    );
  });
});
