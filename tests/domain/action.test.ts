import { agentIntentSchema, supportedActionSchema } from "@/lib/domain/action";

const recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

describe("supportedActionSchema", () => {
  it("accepts and normalizes an ERC-20 transfer", () => {
    const action = supportedActionSchema.parse({
      type: "erc20_transfer",
      chainId: 11155111,
      amount: "1.5",
      recipient: recipient.toLowerCase(),
      tokenAddress: usdc.toLowerCase(),
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      category: "payment",
    });

    if (action.type !== "erc20_transfer") {
      throw new Error("Expected an ERC-20 transfer");
    }

    expect(action.recipient).toBe(recipient);
    expect(action.tokenAddress).toBe(usdc);
  });

  it("rejects a malformed address before policy evaluation", () => {
    expect(() =>
      supportedActionSchema.parse({
        type: "native_transfer",
        chainId: 11155111,
        amount: "0.01",
        recipient: "not-an-address",
        tokenSymbol: "ETH",
        tokenDecimals: 18,
        category: "payment",
      }),
    ).toThrow();
  });

  it("rejects floating-point and exponent amount syntax", () => {
    expect(() =>
      supportedActionSchema.parse({
        type: "native_transfer",
        chainId: 11155111,
        amount: "1e3",
        recipient,
        tokenSymbol: "ETH",
        tokenDecimals: 18,
        category: "payment",
      }),
    ).toThrow();
  });
});

describe("agentIntentSchema", () => {
  it("accepts a schema-complete action intent", () => {
    expect(
      agentIntentSchema.parse({
        kind: "action",
        message: "I prepared a 1 USDC transfer for review.",
        action: {
          type: "erc20_transfer",
          chainId: 11155111,
          amount: "1",
          recipient,
          tokenAddress: usdc,
          tokenSymbol: "USDC",
          tokenDecimals: 6,
          category: "payment",
        },
        unsupportedAction: null,
      }),
    ).toBeDefined();
  });

  it("represents unsupported execution without a fake action payload", () => {
    const intent = agentIntentSchema.parse({
      kind: "unsupported",
      message: "Bridging is not enabled in this release.",
      action: null,
      unsupportedAction: "bridge",
    });

    expect(intent.action).toBeNull();
    expect(intent.unsupportedAction).toBe("bridge");
  });

  it("rejects an action kind with no executable action", () => {
    expect(() =>
      agentIntentSchema.parse({
        kind: "action",
        message: "Ready.",
        action: null,
        unsupportedAction: null,
      }),
    ).toThrow();
  });
});
