import {
  mandateInputSchema,
  toMandatePersistence,
} from "@/lib/schemas/mandate";

const recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const validInput = {
  name: "Operations",
  description: "Routine testnet payments",
  status: "ACTIVE",
  accountingAssetKind: "ERC20",
  accountingChainId: 11155111,
  accountingTokenAddress: usdc,
  accountingTokenSymbol: "USDC",
  accountingTokenDecimals: 6,
  maxTransactionAmount: "5",
  dailyLimitAmount: "25",
  monthlyLimitAmount: "200",
  allowedChainIds: [11155111],
  allowedTokens: [usdc],
  allowedProtocols: [],
  allowedRecipients: [recipient],
  allowedCategories: ["payment"],
  allowedContractAddresses: [],
  requireManualApproval: true,
  expiresAt: "2026-08-30T00:00:00.000Z",
};

describe("mandateInputSchema", () => {
  it("normalizes a valid mandate into exact persistence values", () => {
    const parsed = mandateInputSchema.parse(validInput);

    expect(toMandatePersistence(parsed)).toMatchObject({
      maxTransactionBaseUnits: "5000000",
      dailyLimitBaseUnits: "25000000",
      monthlyLimitBaseUnits: "200000000",
      accountingTokenAddress: usdc,
      allowedRecipients: [recipient],
    });
  });

  it("rejects a daily limit below the per-transaction maximum", () => {
    expect(() =>
      mandateInputSchema.parse({
        ...validInput,
        maxTransactionAmount: "30",
      }),
    ).toThrow();
  });

  it("rejects malformed recipient addresses", () => {
    expect(() =>
      mandateInputSchema.parse({
        ...validInput,
        allowedRecipients: ["0x123"],
      }),
    ).toThrow();
  });

  it("requires an ERC-20 address for ERC-20 accounting", () => {
    expect(() =>
      mandateInputSchema.parse({
        ...validInput,
        accountingTokenAddress: null,
      }),
    ).toThrow();
  });
});
