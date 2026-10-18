import { getAddress, isAddress } from "viem";
import { z } from "zod";

import { parseUnitsExact } from "@/lib/domain/money";

const decimalOrNull = z
  .string()
  .regex(/^(0|[1-9]\d*)(?:\.\d+)?$/)
  .nullable();

const addressSchema = z.string().refine(isAddress, "Use a valid EVM address");

export const mandateInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(280).nullable(),
    status: z.enum(["DRAFT", "ACTIVE"]),
    accountingAssetKind: z.enum(["NATIVE", "ERC20"]),
    accountingChainId: z.number().int().positive(),
    accountingTokenAddress: addressSchema.nullable(),
    accountingTokenSymbol: z.string().trim().min(1).max(32),
    accountingTokenDecimals: z.number().int().min(0).max(255),
    maxTransactionAmount: decimalOrNull,
    dailyLimitAmount: decimalOrNull,
    monthlyLimitAmount: decimalOrNull,
    allowedChainIds: z.array(z.number().int().positive()).min(1),
    allowedTokens: z.array(z.string().min(1)).min(1),
    allowedProtocols: z.array(z.string().trim().min(1).max(64)),
    allowedRecipients: z.array(addressSchema),
    allowedCategories: z.array(z.string().trim().min(1).max(48)).min(1),
    allowedContractAddresses: z.array(addressSchema),
    requireManualApproval: z.boolean(),
    expiresAt: z.iso.datetime().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.accountingAssetKind === "ERC20" &&
      value.accountingTokenAddress === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["accountingTokenAddress"],
        message: "ERC-20 mandates require a token contract address",
      });
    }
    if (
      value.accountingAssetKind === "NATIVE" &&
      value.accountingTokenAddress !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["accountingTokenAddress"],
        message: "Native assets cannot have a token contract address",
      });
    }

    const toUnits = (amount: string | null) =>
      amount === null
        ? null
        : parseUnitsExact(amount, value.accountingTokenDecimals);
    const transaction = toUnits(value.maxTransactionAmount);
    const daily = toUnits(value.dailyLimitAmount);
    const monthly = toUnits(value.monthlyLimitAmount);
    if (transaction !== null && daily !== null && transaction > daily) {
      context.addIssue({
        code: "custom",
        path: ["maxTransactionAmount"],
        message: "Per-transaction limit cannot exceed the daily limit",
      });
    }
    if (daily !== null && monthly !== null && daily > monthly) {
      context.addIssue({
        code: "custom",
        path: ["dailyLimitAmount"],
        message: "Daily limit cannot exceed the monthly limit",
      });
    }
  });

export type MandateInput = z.infer<typeof mandateInputSchema>;

function amountToBaseUnits(
  value: string | null,
  decimals: number,
): string | null {
  return value === null ? null : parseUnitsExact(value, decimals).toString();
}

function normalizeToken(token: string): string {
  return token.toLowerCase() === "native" ? "native" : getAddress(token);
}

export function toMandatePersistence(input: MandateInput) {
  return {
    name: input.name,
    description: input.description,
    status: input.status,
    accountingAssetKind: input.accountingAssetKind,
    accountingChainId: input.accountingChainId,
    accountingTokenAddress:
      input.accountingTokenAddress === null
        ? null
        : getAddress(input.accountingTokenAddress),
    accountingTokenSymbol: input.accountingTokenSymbol,
    accountingTokenDecimals: input.accountingTokenDecimals,
    maxTransactionBaseUnits: amountToBaseUnits(
      input.maxTransactionAmount,
      input.accountingTokenDecimals,
    ),
    dailyLimitBaseUnits: amountToBaseUnits(
      input.dailyLimitAmount,
      input.accountingTokenDecimals,
    ),
    monthlyLimitBaseUnits: amountToBaseUnits(
      input.monthlyLimitAmount,
      input.accountingTokenDecimals,
    ),
    allowedChainIds: [...new Set(input.allowedChainIds)],
    allowedTokens: [...new Set(input.allowedTokens.map(normalizeToken))],
    allowedProtocols: [...new Set(input.allowedProtocols)],
    allowedRecipients: [
      ...new Set(input.allowedRecipients.map((address) => getAddress(address))),
    ],
    allowedCategories: [...new Set(input.allowedCategories)],
    allowedContractAddresses: [
      ...new Set(
        input.allowedContractAddresses.map((address) => getAddress(address)),
      ),
    ],
    requireManualApproval: input.requireManualApproval,
    expiresAt: input.expiresAt === null ? null : new Date(input.expiresAt),
  };
}
