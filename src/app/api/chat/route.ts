import { z } from "zod";

import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import {
  createDefaultGroqIntentGenerator,
  type SupportedChainSummary,
} from "@/lib/providers/groq";
import { createDefaultKeeperHubClient } from "@/lib/providers/keeperhub";
import { ClauseRepository } from "@/lib/repositories/clause";
import { proposeAction } from "@/lib/use-cases/propose-action";

const requestSchema = z
  .object({
    chatId: z.string().min(1).optional(),
    message: z.string().trim().min(1).max(4_000),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const body = requestSchema.parse(await request.json());
    const user = await requireAppUser();
    const repository = new ClauseRepository();
    const keeperHub = createDefaultKeeperHubClient();

    const result = await proposeAction(
      {
        repository,
        generateIntent: createDefaultGroqIntentGenerator(),
        listSupportedChains: async (): Promise<SupportedChainSummary[]> =>
          (await keeperHub.listSupportedChains())
            .filter(
              (chain) =>
                chain.isEnabled &&
                chain.isTestnet &&
                (chain.status === undefined || chain.status === "stable"),
            )
            .map((chain) => ({
              chainId: Number(chain.chainId),
              name: chain.name,
            })),
      },
      { userId: user.id, chatId: body.chatId, message: body.message },
    );

    return apiSuccess(result, correlationId);
  } catch (error) {
    return apiError(error, correlationId);
  }
}
