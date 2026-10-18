import type Groq from "groq-sdk";

import { createGroqIntentGenerator } from "@/lib/providers/groq";

const recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

describe("createGroqIntentGenerator", () => {
  it("uses strict structured output and re-validates the returned intent", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const client = {
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            capturedRequest = request;
            return {
              id: "chatcmpl_1",
              choices: [
                {
                  finish_reason: "stop",
                  index: 0,
                  logprobs: null,
                  message: {
                    role: "assistant",
                    content: JSON.stringify({
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
                  },
                },
              ],
              created: 1,
              model: "openai/gpt-oss-20b",
              object: "chat.completion",
              usage: {
                completion_tokens: 1,
                prompt_tokens: 1,
                total_tokens: 2,
                queue_time: 0,
                prompt_time: 0,
                completion_time: 0,
                total_time: 0,
              },
            };
          },
        },
      },
    } as unknown as Groq;

    const generateIntent = createGroqIntentGenerator(client);
    const result = await generateIntent({
      message: `Send 1 USDC to ${recipient}`,
      history: [],
      mandateSummary: "Sepolia USDC payments up to 5 USDC.",
      supportedChains: [{ chainId: 11155111, name: "Ethereum Sepolia" }],
    });

    expect(result.intent.kind).toBe("action");
    expect(result.providerRequestId).toBe("chatcmpl_1");
    expect(capturedRequest).toMatchObject({
      model: "openai/gpt-oss-20b",
      stream: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "clause_agent_intent",
          strict: true,
        },
      },
    });
  });

  it("rejects schema-invalid provider content", async () => {
    const client = {
      chat: {
        completions: {
          create: async () => ({
            id: "chatcmpl_invalid",
            choices: [
              {
                finish_reason: "stop",
                index: 0,
                logprobs: null,
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    kind: "action",
                    message: "Ready",
                    action: null,
                    unsupportedAction: null,
                  }),
                },
              },
            ],
            created: 1,
            model: "openai/gpt-oss-20b",
            object: "chat.completion",
          }),
        },
      },
    } as unknown as Groq;

    const generateIntent = createGroqIntentGenerator(client);

    await expect(
      generateIntent({
        message: "Do something",
        history: [],
        mandateSummary: "None",
        supportedChains: [],
      }),
    ).rejects.toMatchObject({ code: "GROQ_INVALID_RESPONSE" });
  });
});
