import Groq from "groq-sdk";
import { z } from "zod";

import {
  agentIntentOutputSchema,
  agentIntentSchema,
  type AgentIntent,
} from "@/lib/domain/action";
import { ProviderError } from "@/lib/providers/provider-error";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SupportedChainSummary {
  chainId: number;
  name: string;
}

export interface GenerateIntentInput {
  message: string;
  history: ConversationMessage[];
  mandateSummary: string;
  supportedChains: SupportedChainSummary[];
}

export interface GeneratedIntent {
  intent: AgentIntent;
  providerRequestId: string;
  model: string;
}

export type IntentGenerator = (
  input: GenerateIntentInput,
) => Promise<GeneratedIntent>;

const defaultModel = "openai/gpt-oss-20b";

function buildIntentJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(agentIntentOutputSchema, {
    target: "draft-7",
    unrepresentable: "throw",
  }) as Record<string, unknown>;

  delete schema.$schema;
  return schema;
}

function systemPrompt(
  mandateSummary: string,
  supportedChains: SupportedChainSummary[],
): string {
  const chains = supportedChains
    .map((chain) => `${chain.name} (${chain.chainId})`)
    .join(", ");

  return [
    "You are Clause, a transaction-intent planner.",
    "You may explain and propose an action, but you never execute transactions.",
    "Supported actions are native_transfer, erc20_transfer, and contract_call.",
    "Classify swap, bridge, deploy contract, and mint NFT as unsupported.",
    "Never invent an address, token contract, amount, chain, function, or argument.",
    "If required execution details are missing, return a conversational message and ask for them.",
    `Active mandate summary: ${mandateSummary}`,
    `Enabled stable testnets: ${chains || "none"}`,
  ].join("\n");
}

export function createGroqIntentGenerator(
  client: Groq,
  model = defaultModel,
): IntentGenerator {
  return async (input) => {
    try {
      const response = await client.chat.completions.create({
        model,
        stream: false,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: systemPrompt(input.mandateSummary, input.supportedChains),
          },
          ...input.history,
          { role: "user", content: input.message },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "clause_agent_intent",
            description:
              "A conversational response, supported Clause action, or explicitly unsupported action.",
            strict: true,
            schema: buildIntentJsonSchema(),
          },
        },
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new ProviderError({
          code: "GROQ_EMPTY_RESPONSE",
          message: "Groq returned no intent",
          retryable: true,
          providerRequestId: response.id,
        });
      }

      let decoded: unknown;
      try {
        decoded = JSON.parse(content);
      } catch (cause) {
        throw new ProviderError({
          code: "GROQ_INVALID_RESPONSE",
          message: "Groq returned invalid JSON",
          retryable: true,
          providerRequestId: response.id,
          cause,
        });
      }

      const parsed = agentIntentSchema.safeParse(decoded);
      if (!parsed.success) {
        throw new ProviderError({
          code: "GROQ_INVALID_RESPONSE",
          message: "Groq returned an intent outside the Clause schema",
          retryable: true,
          providerRequestId: response.id,
          cause: parsed.error,
        });
      }

      return {
        intent: parsed.data,
        providerRequestId: response.id,
        model: response.model,
      };
    } catch (cause) {
      if (cause instanceof ProviderError) {
        throw cause;
      }

      const status =
        typeof cause === "object" &&
        cause !== null &&
        "status" in cause &&
        typeof cause.status === "number"
          ? cause.status
          : undefined;

      throw new ProviderError({
        code: status === 429 ? "GROQ_RATE_LIMITED" : "GROQ_REQUEST_FAILED",
        message: "Groq could not produce a transaction intent",
        retryable: status === 429 || status === undefined || status >= 500,
        cause,
      });
    }
  };
}

export function createDefaultGroqIntentGenerator(): IntentGenerator {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required");
  }

  return createGroqIntentGenerator(
    new Groq({ apiKey }),
    process.env.GROQ_MODEL ?? defaultModel,
  );
}
