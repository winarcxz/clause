import type { ProposalView } from "@/components/execution/proposal-card";

export interface MandateRecord {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
  accountingAssetKind: "NATIVE" | "ERC20";
  accountingChainId: number;
  accountingTokenAddress: string | null;
  accountingTokenSymbol: string;
  accountingTokenDecimals: number;
  maxTransactionBaseUnits: string | null;
  dailyLimitBaseUnits: string | null;
  monthlyLimitBaseUnits: string | null;
  allowedChainIds: number[];
  allowedTokens: string[];
  allowedProtocols: string[];
  allowedRecipients: string[];
  allowedCategories: string[];
  allowedContractAddresses: string[];
  requireManualApproval: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { proposals: number };
}

export interface WalletRecord {
  id: string;
  address: string;
  chainId: number | null;
  label: string | null;
}

export interface DashboardData {
  mandates: MandateRecord[];
  recentExecutions: Array<{
    id: string;
    status: string;
    transactionHash: string | null;
    transactionLink: string | null;
    gasUsedWei: string | null;
    createdAt: string;
    proposal: {
      explanation: string;
      actionType: string;
      actionJson: Record<string, unknown> | null;
    };
  }>;
  activeChats: number;
  wallet: WalletRecord | null;
  spendThisMonth: Array<{
    chainId: number;
    symbol: string;
    decimals: number;
    baseUnits: string;
  }>;
}

export interface ChatRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "SYSTEM";
    content: string;
    createdAt: string;
  }>;
  proposals: ProposalView[];
}

export interface AuditRecord {
  id: string;
  type: string;
  actor: string;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  proposal: {
    id: string;
    explanation: string;
    actionType: string;
    status: string;
  } | null;
  execution: {
    id: string;
    keeperHubExecutionId: string | null;
    status: string;
    transactionHash: string | null;
    transactionLink: string | null;
    gasUsedWei: string | null;
    errorMessage: string | null;
  } | null;
}

export interface SettingsData {
  settings: {
    aiPaused: boolean;
    theme: "light" | "dark" | "system";
    defaultMandateId: string | null;
    preferredChainId: number | null;
  };
  wallet: WalletRecord | null;
}

export interface IntegrationHealth {
  groq: { configured: boolean };
  database: { configured: boolean };
  keeperHub: {
    configured: boolean;
    mcp: {
      healthy: boolean;
      discoveryTools: string[];
      blockedExecutionTools: string[];
    } | null;
  };
}
