"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleAlert,
  Database,
  KeyRound,
  Moon,
  PlugZap,
  Power,
  Server,
  Sun,
  Unplug,
  WalletCards,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { PageHeader } from "@/components/product/page-header";
import { PageSkeleton, QueryError } from "@/components/product/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/client-api";
import type {
  IntegrationHealth,
  SettingsData,
} from "@/lib/product-types";
import { cn } from "@/lib/utils";

function shortAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  danger = false,
}: {
  icon: typeof KeyRound;
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={cn(
        "grid gap-5 border-t border-[var(--border)] py-7 first:border-0 first:pt-0 md:grid-cols-[230px_1fr]",
        danger && "border-[var(--danger)]/20",
      )}
    >
      <div>
        <span
          className={cn(
            "grid size-8 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--muted)]",
            danger && "bg-[var(--danger-soft)] text-[var(--danger)]",
          )}
        >
          <Icon className="size-4" />
        </span>
        <h2 className="mt-3 text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function HealthRow({
  icon: Icon,
  label,
  healthy,
  detail,
}: {
  icon: typeof Server;
  label: string;
  healthy: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] py-3 last:border-0">
      <span className="grid size-8 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--muted)]">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-[var(--muted)]">{detail}</p>
      </div>
      <Badge tone={healthy ? "success" : "warning"}>
        {healthy ? "configured" : "needs key"}
      </Badge>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const account = useAccount();
  const connectState = useConnect();
  const disconnectState = useDisconnect();

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<SettingsData>("/api/settings"),
  });
  const healthQuery = useQuery({
    queryKey: ["integration-health"],
    queryFn: () => apiFetch<IntegrationHealth>("/api/integrations/health"),
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch<unknown>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (settingsQuery.isLoading) return <PageSkeleton />;
  if (settingsQuery.isError) {
    return (
      <QueryError
        message={settingsQuery.error.message}
        retry={() => void settingsQuery.refetch()}
      />
    );
  }
  if (!settingsQuery.data) return <PageSkeleton />;

  const savedWallet = settingsQuery.data.wallet;
  const connectedAddress = account.address;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Connect a public wallet identity, inspect provider readiness, and control whether the AI may prepare new actions."
      />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 shadow-[var(--shadow-xs)] sm:px-7">
        <SettingsSection
          icon={WalletCards}
          title="Wallet"
          description="Clause records your public wallet identity. KeeperHub retains the shared testnet execution authority."
        >
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {connectedAddress
                    ? shortAddress(connectedAddress)
                    : savedWallet
                      ? shortAddress(savedWallet.address)
                      : "No wallet linked"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {account.isConnected
                    ? `Connected on chain ${account.chainId ?? "unknown"}`
                    : savedWallet
                      ? `Saved identity · chain ${savedWallet.chainId ?? "not recorded"}`
                      : "Use an injected Ethereum-compatible wallet."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!account.isConnected &&
                  connectState.connectors.map((connector) => (
                    <Button
                      key={connector.uid}
                      variant="secondary"
                      size="sm"
                      onClick={() => connectState.connect({ connector })}
                    >
                      <PlugZap className="size-3.5" />
                      Connect {connector.name}
                    </Button>
                  ))}
                {account.isConnected && connectedAddress && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          wallet: {
                            address: connectedAddress,
                            chainId: account.chainId ?? null,
                          },
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      <Check className="size-3.5" /> Save identity
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectState.disconnect()}
                    >
                      <Unplug className="size-3.5" /> Disconnect
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={KeyRound}
          title="Provider readiness"
          description="Secrets stay server-side. This view exposes configuration health, never key values."
        >
          <div className="rounded-lg border border-[var(--border)] px-4">
            <HealthRow
              icon={Database}
              label="PostgreSQL"
              healthy={healthQuery.data?.database.configured ?? false}
              detail="Persistence for mandates, simulations, and audit evidence"
            />
            <HealthRow
              icon={Server}
              label="Groq"
              healthy={healthQuery.data?.groq.configured ?? false}
              detail="Strict structured intent generation with GPT-OSS"
            />
            <HealthRow
              icon={PlugZap}
              label="KeeperHub"
              healthy={healthQuery.data?.keeperHub.configured ?? false}
              detail={
                healthQuery.data?.keeperHub.mcp?.healthy
                  ? "REST execution and MCP discovery are reachable"
                  : "REST execution key and read-only MCP discovery"
              }
            />
          </div>
          {healthQuery.isError && (
            <p className="mt-2 text-xs text-[var(--warning)]">
              Provider health could not be checked. Saved settings remain available.
            </p>
          )}
        </SettingsSection>

        <SettingsSection
          icon={theme === "dark" ? Moon : Sun}
          title="Appearance"
          description="Use the system setting or choose a stable light or dark workspace."
        >
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--surface-subtle)] p-1">
            {(["light", "dark", "system"] as const).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setTheme(option);
                  updateMutation.mutate({ theme: option });
                }}
                className={cn(
                  "h-9 rounded-md text-xs font-medium capitalize transition-colors",
                  theme === option
                    ? "bg-[var(--surface)] shadow-[var(--shadow-xs)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Power}
          title="AI execution pause"
          description="Immediately stop new AI proposals while preserving mandates, chats, and audit evidence."
          danger
        >
          <div className="flex items-center justify-between gap-5 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)]/25 p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleAlert className="size-4 text-[var(--danger)]" />
                Pause AI proposals
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Existing execution records are untouched. New chat actions receive a locked response.
              </p>
            </div>
            <Switch
              checked={settingsQuery.data.settings.aiPaused}
              onCheckedChange={(aiPaused) => updateMutation.mutate({ aiPaused })}
              disabled={updateMutation.isPending}
            />
          </div>
        </SettingsSection>
      </div>
    </>
  );
}
