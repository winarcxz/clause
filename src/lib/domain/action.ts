import { getAddress, isAddress, type Address } from "viem";
import { z } from "zod";

const decimalAmountSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(?:\.\d+)?$/, "Use a non-negative decimal string");

const rawAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Use a 20-byte EVM address")
  .refine(isAddress, "Use a valid EVM address");

const commonActionFields = {
  chainId: z.number().int().positive(),
  category: z.string().trim().min(1).max(48),
};

export const nativeTransferOutputSchema = z
  .object({
    type: z.literal("native_transfer"),
    ...commonActionFields,
    amount: decimalAmountSchema,
    recipient: rawAddressSchema,
    tokenSymbol: z.string().trim().min(1).max(16),
    tokenDecimals: z.number().int().min(0).max(255),
  })
  .strict();

export const erc20TransferOutputSchema = z
  .object({
    type: z.literal("erc20_transfer"),
    ...commonActionFields,
    amount: decimalAmountSchema,
    recipient: rawAddressSchema,
    tokenAddress: rawAddressSchema,
    tokenSymbol: z.string().trim().min(1).max(32),
    tokenDecimals: z.number().int().min(0).max(255),
  })
  .strict();

export const contractCallOutputSchema = z
  .object({
    type: z.literal("contract_call"),
    ...commonActionFields,
    contractAddress: rawAddressSchema,
    functionName: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use a Solidity function name"),
    functionArgs: z.array(z.string()).max(32),
    value: decimalAmountSchema,
  })
  .strict();

export const supportedActionOutputSchema = z.discriminatedUnion("type", [
  nativeTransferOutputSchema,
  erc20TransferOutputSchema,
  contractCallOutputSchema,
]);

type RawSupportedAction = z.infer<typeof supportedActionOutputSchema>;

export type NativeTransferAction = Omit<
  z.infer<typeof nativeTransferOutputSchema>,
  "recipient"
> & {
  recipient: Address;
};

export type Erc20TransferAction = Omit<
  z.infer<typeof erc20TransferOutputSchema>,
  "recipient" | "tokenAddress"
> & {
  recipient: Address;
  tokenAddress: Address;
};

export type ContractCallAction = Omit<
  z.infer<typeof contractCallOutputSchema>,
  "contractAddress"
> & {
  contractAddress: Address;
};

export type SupportedAction =
  | NativeTransferAction
  | Erc20TransferAction
  | ContractCallAction;

function normalizeAction(action: RawSupportedAction): SupportedAction {
  switch (action.type) {
    case "native_transfer":
      return { ...action, recipient: getAddress(action.recipient) };
    case "erc20_transfer":
      return {
        ...action,
        recipient: getAddress(action.recipient),
        tokenAddress: getAddress(action.tokenAddress),
      };
    case "contract_call":
      return {
        ...action,
        contractAddress: getAddress(action.contractAddress),
      };
  }
}

export const supportedActionSchema = supportedActionOutputSchema.transform(normalizeAction);

export const unsupportedActionSchema = z.enum([
  "swap",
  "bridge",
  "deploy_contract",
  "mint_nft",
  "unknown",
]);

export const agentIntentOutputSchema = z
  .object({
    kind: z.enum(["message", "action", "unsupported"]),
    message: z.string().trim().min(1).max(2_000),
    action: supportedActionOutputSchema.nullable(),
    unsupportedAction: unsupportedActionSchema.nullable(),
  })
  .strict();

export const agentIntentSchema = agentIntentOutputSchema
  .superRefine((intent, context) => {
    const validShape =
      (intent.kind === "action" &&
        intent.action !== null &&
        intent.unsupportedAction === null) ||
      (intent.kind === "unsupported" &&
        intent.action === null &&
        intent.unsupportedAction !== null) ||
      (intent.kind === "message" &&
        intent.action === null &&
        intent.unsupportedAction === null);

    if (!validShape) {
      context.addIssue({
        code: "custom",
        message: "Intent fields do not match the declared kind",
      });
    }
  })
  .transform((intent) => ({
    ...intent,
    action: intent.action === null ? null : normalizeAction(intent.action),
  }));

export type AgentIntent = z.infer<typeof agentIntentSchema>;
