import type { SupportedAction } from "@/lib/domain/action";
import {
  buildKeeperHubPayload,
  KeeperHubClient,
} from "@/lib/providers/keeperhub";

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

describe("buildKeeperHubPayload", () => {
  it("maps an ERC-20 transfer to one canonical direct-execution body", () => {
    expect(buildKeeperHubPayload(action)).toEqual({
      chainId: 11155111,
      recipientAddress: recipient,
      amount: "1",
      tokenAddress: usdc,
      gasLimitMultiplier: "1.2",
    });
  });
});

describe("KeeperHubClient", () => {
  it("simulates without an idempotency header or broadcast", async () => {
    const requests: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init = {}) => {
      requests.push({ input: String(input), init });
      return Response.json({
        success: true,
        status: "simulated",
        from: recipient,
        to: recipient,
        value: "0",
        gasEstimate: "65000",
        simulatedReturnValue: true,
        wouldRevert: false,
      });
    };
    const client = new KeeperHubClient({
      apiKey: "kh_test",
      baseUrl: "https://app.keeperhub.com/api",
      fetchImpl,
    });

    const result = await client.simulateAction(action);

    expect(result.gasEstimate).toBe("65000");
    expect(requests).toHaveLength(1);
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      ...buildKeeperHubPayload(action),
      simulate: true,
    });
    expect(new Headers(requests[0]?.init.headers).has("Idempotency-Key")).toBe(false);
  });

  it("broadcasts the canonical body with a durable idempotency key", async () => {
    const requests: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init = {}) => {
      requests.push({ input: String(input), init });
      return Response.json(
        { executionId: "direct_123", status: "completed" },
        { status: 202 },
      );
    };
    const client = new KeeperHubClient({
      apiKey: "kh_test",
      baseUrl: "https://app.keeperhub.com/api/",
      fetchImpl,
    });

    const result = await client.executeAction(action, "proposal_123");

    expect(result.executionId).toBe("direct_123");
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual(
      buildKeeperHubPayload(action),
    );
    expect(new Headers(requests[0]?.init.headers).get("Idempotency-Key")).toBe(
      "proposal_123",
    );
  });

  it("maps a provider error to a stable safe error", async () => {
    const client = new KeeperHubClient({
      apiKey: "kh_test",
      baseUrl: "https://app.keeperhub.com/api",
      fetchImpl: async () =>
        Response.json(
          {
            error: "Daily spending cap exceeded",
            request_id: "req_123",
          },
          { status: 403 },
        ),
    });

    await expect(client.executeAction(action, "proposal_123")).rejects.toMatchObject({
      code: "KEEPERHUB_REJECTED",
      providerRequestId: "req_123",
      retryable: false,
    });
  });
});
