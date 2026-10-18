import { getAddress, isAddressEqual, type Address } from "viem";

import type { SupportedAction } from "@/lib/domain/action";
import { parseUnitsExact } from "@/lib/domain/money";

export type MandateStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";

export type AccountingAsset =
  | {
      kind: "native";
      chainId: number;
      address: null;
      symbol: string;
      decimals: number;
    }
  | {
      kind: "erc20";
      chainId: number;
      address: Address;
      symbol: string;
      decimals: number;
    };

export interface MandateSnapshot {
  id: string;
  name: string;
  status: MandateStatus;
  expiresAt: string | null;
  maxTransactionBaseUnits: string | null;
  dailyLimitBaseUnits: string | null;
  monthlyLimitBaseUnits: string | null;
  accountingAsset: AccountingAsset;
  allowedChainIds: number[];
  allowedTokens: string[];
  allowedRecipients: Address[];
  allowedCategories: string[];
  allowedContractAddresses: Address[];
  requireManualApproval: boolean;
}

export interface SpendSnapshot {
  todayBaseUnits: string;
  monthBaseUnits: string;
}

export type MandateCheckCode =
  | "MANDATE_ACTIVE"
  | "MANDATE_NOT_EXPIRED"
  | "CHAIN_ALLOWED"
  | "ACCOUNTING_ASSET_MATCH"
  | "TOKEN_ALLOWED"
  | "RECIPIENT_ALLOWED"
  | "CATEGORY_ALLOWED"
  | "CONTRACT_ALLOWED"
  | "TRANSACTION_LIMIT"
  | "DAILY_LIMIT"
  | "MONTHLY_LIMIT"
  | "MANUAL_APPROVAL";

export interface MandateCheck {
  code: MandateCheckCode;
  label: string;
  passed: boolean;
  detail: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface MandateEvaluation {
  allowed: boolean;
  requiresManualApproval: boolean;
  checks: MandateCheck[];
}

interface ActionAsset {
  kind: "native" | "erc20";
  chainId: number;
  address: Address | null;
  decimals: number;
}

function getActionAsset(action: SupportedAction): ActionAsset {
  if (action.type === "erc20_transfer") {
    return {
      kind: "erc20",
      chainId: action.chainId,
      address: action.tokenAddress,
      decimals: action.tokenDecimals,
    };
  }

  return {
    kind: "native",
    chainId: action.chainId,
    address: null,
    decimals: action.type === "native_transfer" ? action.tokenDecimals : 18,
  };
}

function getActionAmount(action: SupportedAction): string {
  return action.type === "contract_call" ? action.value : action.amount;
}

function sameAddress(left: string, right: string): boolean {
  try {
    return isAddressEqual(getAddress(left), getAddress(right));
  } catch {
    return false;
  }
}

function assetMatches(actionAsset: ActionAsset, mandateAsset: AccountingAsset): boolean {
  if (
    actionAsset.kind !== mandateAsset.kind ||
    actionAsset.chainId !== mandateAsset.chainId ||
    actionAsset.decimals !== mandateAsset.decimals
  ) {
    return false;
  }

  if (actionAsset.kind === "native" && mandateAsset.kind === "native") {
    return true;
  }

  return (
    actionAsset.address !== null &&
    mandateAsset.address !== null &&
    sameAddress(actionAsset.address, mandateAsset.address)
  );
}

function optionalLimitPasses(
  limit: string | null,
  amount: bigint,
  alreadySpent = 0n,
): boolean {
  return limit === null || alreadySpent + amount <= BigInt(limit);
}

function check(
  code: MandateCheckCode,
  label: string,
  passed: boolean,
  detail: string,
  evidence: MandateCheck["evidence"] = {},
): MandateCheck {
  return { code, label, passed, detail, evidence };
}

export function evaluateMandate(
  action: SupportedAction,
  mandate: MandateSnapshot,
  spend: SpendSnapshot,
  now = new Date(),
): MandateEvaluation {
  const actionAsset = getActionAsset(action);
  const actionAmount = parseUnitsExact(getActionAmount(action), actionAsset.decimals);
  const todaySpent = BigInt(spend.todayBaseUnits);
  const monthSpent = BigInt(spend.monthBaseUnits);
  const matchesAccountingAsset = assetMatches(actionAsset, mandate.accountingAsset);
  const tokenIdentifier =
    actionAsset.kind === "native" ? "native" : actionAsset.address;
  const expiresAt = mandate.expiresAt === null ? null : new Date(mandate.expiresAt);

  const checks: MandateCheck[] = [
    check(
      "MANDATE_ACTIVE",
      "Mandate is active",
      mandate.status === "ACTIVE",
      mandate.status === "ACTIVE"
        ? "This mandate is active."
        : `This mandate is ${mandate.status.toLowerCase()}.`,
      { status: mandate.status },
    ),
    check(
      "MANDATE_NOT_EXPIRED",
      "Mandate has not expired",
      expiresAt === null || (Number.isFinite(expiresAt.getTime()) && expiresAt > now),
      expiresAt === null
        ? "This mandate has no expiry."
        : `Expiry is ${expiresAt.toISOString()}.`,
      { expiresAt: mandate.expiresAt },
    ),
    check(
      "CHAIN_ALLOWED",
      "Network is allowed",
      mandate.allowedChainIds.includes(action.chainId),
      `Chain ${action.chainId} is ${
        mandate.allowedChainIds.includes(action.chainId) ? "allowed" : "not allowed"
      }.`,
      { chainId: action.chainId },
    ),
    check(
      "ACCOUNTING_ASSET_MATCH",
      "Asset matches mandate accounting",
      matchesAccountingAsset,
      matchesAccountingAsset
        ? "The action uses the mandate accounting asset."
        : "The action asset cannot be counted safely against this mandate.",
      {
        actionAsset: tokenIdentifier,
        accountingAsset: mandate.accountingAsset.address ?? "native",
      },
    ),
    check(
      "TOKEN_ALLOWED",
      "Asset is allowed",
      mandate.allowedTokens.some((token) =>
        tokenIdentifier === null
          ? false
          : tokenIdentifier === "native"
            ? token.toLowerCase() === "native"
            : sameAddress(token, tokenIdentifier),
      ),
      `${tokenIdentifier ?? "unknown"} is checked against the token allowlist.`,
      { token: tokenIdentifier },
    ),
    check(
      "RECIPIENT_ALLOWED",
      "Recipient is allowed",
      action.type === "contract_call" ||
        mandate.allowedRecipients.some((recipient) =>
          sameAddress(recipient, action.recipient),
        ),
      action.type === "contract_call"
        ? "Contract calls use the contract allowlist."
        : "The transfer recipient is checked against the recipient allowlist.",
      {
        recipient: action.type === "contract_call" ? null : action.recipient,
      },
    ),
    check(
      "CATEGORY_ALLOWED",
      "Category is allowed",
      mandate.allowedCategories.includes(action.category),
      `Category "${action.category}" is ${
        mandate.allowedCategories.includes(action.category) ? "allowed" : "not allowed"
      }.`,
      { category: action.category },
    ),
    check(
      "CONTRACT_ALLOWED",
      "Contract is allowed",
      action.type !== "contract_call" ||
        mandate.allowedContractAddresses.some((address) =>
          sameAddress(address, action.contractAddress),
        ),
      action.type === "contract_call"
        ? "The target contract is checked against the contract allowlist."
        : "This transfer does not call a contract directly.",
      {
        contractAddress:
          action.type === "contract_call" ? action.contractAddress : null,
      },
    ),
    check(
      "TRANSACTION_LIMIT",
      "Transaction is within limit",
      matchesAccountingAsset &&
        optionalLimitPasses(mandate.maxTransactionBaseUnits, actionAmount),
      "The exact base-unit amount is compared with the per-transaction ceiling.",
      {
        amountBaseUnits: actionAmount.toString(),
        limitBaseUnits: mandate.maxTransactionBaseUnits,
      },
    ),
    check(
      "DAILY_LIMIT",
      "Daily spend remains within limit",
      matchesAccountingAsset &&
        optionalLimitPasses(mandate.dailyLimitBaseUnits, actionAmount, todaySpent),
      "Today's confirmed spend plus this action is compared with the daily ceiling.",
      {
        spentBaseUnits: todaySpent.toString(),
        amountBaseUnits: actionAmount.toString(),
        limitBaseUnits: mandate.dailyLimitBaseUnits,
      },
    ),
    check(
      "MONTHLY_LIMIT",
      "Monthly spend remains within limit",
      matchesAccountingAsset &&
        optionalLimitPasses(mandate.monthlyLimitBaseUnits, actionAmount, monthSpent),
      "This month's confirmed spend plus this action is compared with the monthly ceiling.",
      {
        spentBaseUnits: monthSpent.toString(),
        amountBaseUnits: actionAmount.toString(),
        limitBaseUnits: mandate.monthlyLimitBaseUnits,
      },
    ),
    check(
      "MANUAL_APPROVAL",
      "Approval policy recorded",
      true,
      mandate.requireManualApproval
        ? "Manual approval is required before execution."
        : "This mandate permits automatic approval, but Clause still previews launch actions.",
      { required: mandate.requireManualApproval },
    ),
  ];

  return {
    allowed: checks.every((item) => item.passed),
    requiresManualApproval: mandate.requireManualApproval,
    checks,
  };
}
