import { getAddress, isAddress } from "viem";
import { z } from "zod";

import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { ClauseRepository } from "@/lib/repositories/clause";

const settingsSchema = z
  .object({
    aiPaused: z.boolean().optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    preferredChainId: z.number().int().positive().nullable().optional(),
    wallet: z
      .object({
        address: z
          .string()
          .refine(isAddress)
          .transform((address) => getAddress(address)),
        chainId: z.number().int().positive().nullable(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    return apiSuccess(
      await new ClauseRepository().getSettings(user.id),
      correlationId,
    );
  } catch (error) {
    return apiError(error, correlationId);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    const input = settingsSchema.parse(await request.json());
    return apiSuccess(
      await new ClauseRepository().updateSettings(user.id, input),
      correlationId,
    );
  } catch (error) {
    return apiError(error, correlationId);
  }
}
