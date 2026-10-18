import { z } from "zod";

import type { SupportedAction } from "@/lib/domain/action";
import { ProviderError } from "@/lib/providers/provider-error";

export type KeeperHubPayload = Record<
  string,
  string | number | boolean
>;

export function buildKeeperHubPayload(
  action: SupportedAction,
): KeeperHubPayload {
  switch (action.type) {
    case "native_transfer":
      return {
        chainId: action.chainId,
        recipientAddress: action.recipient,
        amount: action.amount,
        gasLimitMultiplier: "1.2",
      };
    case "erc20_transfer":
      return {
        chainId: action.chainId,
        recipientAddress: action.recipient,
        amount: action.amount,
        tokenAddress: action.tokenAddress,
        gasLimitMultiplier: "1.2",
      };
    case "contract_call":
      return {
        chainId: action.chainId,
        contractAddress: action.contractAddress,
        functionName: action.functionName,
        functionArgs: JSON.stringify(action.functionArgs),
        value: action.value,
        gasLimitMultiplier: "1.2",
      };
  }
}

const simulationSchema = z
  .object({
    success: z.literal(true),
    status: z.literal("simulated"),
    from: z.string(),
    to: z.string(),
    value: z.string().default("0"),
    gasEstimate: z.string(),
    simulatedReturnValue: z.unknown().optional(),
    wouldRevert: z.boolean(),
  })
  .passthrough();

const executionSchema = z
  .object({
    executionId: z.string().min(1),
    status: z.string().min(1),
  })
  .passthrough();

const executionStatusSchema = z
  .object({
    executionId: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    type: z.string().optional(),
    transactionHash: z.string().nullable().optional(),
    transactionLink: z.string().nullable().optional(),
    gasUsedWei: z.string().nullable().optional(),
    result: z.unknown().optional(),
    error: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    completedAt: z.string().nullable().optional(),
  })
  .passthrough();

const chainSchema = z
  .object({
    chainId: z.union([z.number(), z.string()]),
    name: z.string(),
    isEnabled: z.boolean(),
    isTestnet: z.boolean(),
    status: z.string().optional(),
  })
  .passthrough();

export type KeeperHubSimulation = z.infer<typeof simulationSchema>;
export type KeeperHubExecution = z.infer<typeof executionSchema>;
export type KeeperHubExecutionStatus = z.infer<typeof executionStatusSchema>;
export type KeeperHubChain = z.infer<typeof chainSchema>;

export interface KeeperHubClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class KeeperHubClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: KeeperHubClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async simulateAction(action: SupportedAction): Promise<KeeperHubSimulation> {
    return simulationSchema.parse(
      await this.request(this.endpointFor(action), {
        method: "POST",
        body: JSON.stringify({
          ...buildKeeperHubPayload(action),
          simulate: true,
        }),
      }),
    );
  }

  async executeAction(
    action: SupportedAction,
    idempotencyKey: string,
  ): Promise<KeeperHubExecution> {
    return executionSchema.parse(
      await this.request(this.endpointFor(action), {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(buildKeeperHubPayload(action)),
      }),
    );
  }

  async getExecutionStatus(
    executionId: string,
  ): Promise<KeeperHubExecutionStatus> {
    return executionStatusSchema.parse(
      await this.request(`/execute/${encodeURIComponent(executionId)}/status`, {
        method: "GET",
      }),
    );
  }

  async listSupportedChains(): Promise<KeeperHubChain[]> {
    const result = await this.request("/chains", { method: "GET" });
    const chains =
      typeof result === "object" &&
      result !== null &&
      "data" in result &&
      Array.isArray(result.data)
        ? result.data
        : result;

    return z.array(chainSchema).parse(chains);
  }

  private endpointFor(action: SupportedAction): string {
    return action.type === "contract_call"
      ? "/execute/contract-call"
      : "/execute/transfer";
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const requestId = crypto.randomUUID();
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
          ...init.headers,
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (cause) {
      throw new ProviderError({
        code: "KEEPERHUB_UNAVAILABLE",
        message: "KeeperHub could not be reached",
        retryable: true,
        providerRequestId: requestId,
        cause,
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new ProviderError({
        code: "KEEPERHUB_INVALID_RESPONSE",
        message: "KeeperHub returned a non-JSON response",
        retryable: response.status >= 500,
        providerRequestId:
          response.headers.get("x-request-id") ?? requestId,
        cause,
      });
    }

    if (!response.ok) {
      const providerRequestId =
        typeof body === "object" &&
        body !== null &&
        "request_id" in body &&
        typeof body.request_id === "string"
          ? body.request_id
          : (response.headers.get("x-request-id") ?? requestId);

      throw new ProviderError({
        code:
          response.status === 429
            ? "KEEPERHUB_RATE_LIMITED"
            : "KEEPERHUB_REJECTED",
        message: "KeeperHub rejected the execution request",
        retryable: response.status === 429 || response.status >= 500,
        providerRequestId,
        cause: body,
      });
    }

    return body;
  }
}

export function createDefaultKeeperHubClient(): KeeperHubClient {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  if (!apiKey) {
    throw new Error("KEEPERHUB_API_KEY is required");
  }

  return new KeeperHubClient({
    apiKey,
    baseUrl:
      process.env.KEEPERHUB_BASE_URL ?? "https://app.keeperhub.com/api",
  });
}
