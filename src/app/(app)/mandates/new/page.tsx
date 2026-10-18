"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Network,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/product/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-api";
import type { MandateRecord } from "@/lib/product-types";

const sepoliaUsdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

function lines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      {hint && <span className="ml-2 text-[11px] text-[var(--muted)]">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 border-t border-[var(--border)] py-7 first:border-0 first:pt-0 md:grid-cols-[220px_1fr]">
      <div>
        <span className="grid size-8 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--muted)]">
          <Icon className="size-4" />
        </span>
        <h2 className="mt-3 text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

export default function NewMandatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [assetKind, setAssetKind] = useState<"NATIVE" | "ERC20">("ERC20");
  const [manualApproval, setManualApproval] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch<MandateRecord>("/api/mandates", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["mandates"] });
      toast.success("Mandate activated");
      router.push("/dashboard");
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const tokenAddress =
      assetKind === "ERC20" ? String(form.get("tokenAddress") ?? "").trim() : null;
    const recipients = lines(String(form.get("recipients") ?? ""));
    if (recipients.length === 0) {
      setError("Add at least one recipient. Clause never treats an empty allowlist as a wildcard.");
      return;
    }

    const expiry = String(form.get("expiresAt") ?? "").trim();
    const nullable = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value === "" ? null : value;
    };

    mutation.mutate({
      name: String(form.get("name") ?? "").trim(),
      description: nullable("description"),
      status: "ACTIVE",
      accountingAssetKind: assetKind,
      accountingChainId: Number(form.get("chainId")),
      accountingTokenAddress: tokenAddress,
      accountingTokenSymbol: String(form.get("tokenSymbol") ?? "").trim(),
      accountingTokenDecimals: Number(form.get("tokenDecimals")),
      maxTransactionAmount: nullable("maxTransaction"),
      dailyLimitAmount: nullable("dailyLimit"),
      monthlyLimitAmount: nullable("monthlyLimit"),
      allowedChainIds: lines(String(form.get("allowedChains") ?? "")).map(Number),
      allowedTokens: assetKind === "NATIVE" ? ["native"] : [tokenAddress],
      allowedProtocols: lines(String(form.get("protocols") ?? "")),
      allowedRecipients: recipients,
      allowedCategories: lines(String(form.get("categories") ?? "")),
      allowedContractAddresses: lines(String(form.get("contracts") ?? "")),
      requireManualApproval: manualApproval,
      expiresAt: expiry === "" ? null : new Date(`${expiry}T23:59:59.000Z`).toISOString(),
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Policy builder"
        title="Create a mandate"
        description="Define a narrow, deterministic envelope for one accounting asset. Any action outside it is rejected before simulation."
      />

      <form
        onSubmit={submit}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 shadow-[var(--shadow-xs)] sm:px-7"
      >
        <Section
          icon={ShieldCheck}
          title="Identity"
          description="A clear name makes approvals and audit entries easier to review."
        >
          <Field label="Mandate name">
            <Input name="name" required minLength={2} maxLength={80} placeholder="Vendor payments" />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea
              name="description"
              maxLength={280}
              placeholder="Testnet operating payments for approved recipients."
            />
          </Field>
        </Section>

        <Section
          icon={CircleDollarSign}
          title="Accounting asset"
          description="Limits are enforced in exact base units for a single native or ERC-20 asset."
        >
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-[var(--surface-subtle)] p-1">
            {(["ERC20", "NATIVE"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setAssetKind(kind)}
                className={`h-9 rounded-md text-xs font-medium transition-colors ${
                  assetKind === kind
                    ? "bg-[var(--surface)] shadow-[var(--shadow-xs)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {kind === "ERC20" ? "ERC-20 token" : "Native asset"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Symbol">
              <Input name="tokenSymbol" defaultValue={assetKind === "ERC20" ? "USDC" : "ETH"} required />
            </Field>
            <Field label="Decimals">
              <Input
                name="tokenDecimals"
                type="number"
                min={0}
                max={255}
                defaultValue={assetKind === "ERC20" ? 6 : 18}
                required
              />
            </Field>
            <Field label="Accounting chain">
              <Input name="chainId" type="number" min={1} defaultValue={11155111} required />
            </Field>
          </div>
          {assetKind === "ERC20" && (
            <Field label="Token contract" hint="Sepolia USDC by default">
              <Input name="tokenAddress" defaultValue={sepoliaUsdc} required />
            </Field>
          )}
        </Section>

        <Section
          icon={Network}
          title="Limits and networks"
          description="Per-transaction, daily, and monthly ceilings are independently enforced."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Maximum transaction">
              <Input name="maxTransaction" inputMode="decimal" defaultValue="5" required />
            </Field>
            <Field label="Daily limit">
              <Input name="dailyLimit" inputMode="decimal" defaultValue="20" required />
            </Field>
            <Field label="Monthly limit">
              <Input name="monthlyLimit" inputMode="decimal" defaultValue="100" required />
            </Field>
          </div>
          <Field label="Allowed chain IDs" hint="Comma or newline separated">
            <Textarea name="allowedChains" defaultValue="11155111" required />
          </Field>
        </Section>

        <Section
          icon={Users}
          title="Allowlists"
          description="Recipients and categories are exact-match lists. Empty contract lists block contract calls."
        >
          <Field label="Allowed recipients" hint="One EVM address per line">
            <Textarea
              name="recipients"
              required
              placeholder={"0x…\n0x…"}
              className="min-h-24 font-mono text-xs"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Allowed categories">
              <Textarea name="categories" defaultValue={"payment\noperations"} required />
            </Field>
            <Field label="Allowed protocols" hint="Recorded for policy context">
              <Textarea name="protocols" placeholder={"uniswap\nsafe"} />
            </Field>
          </div>
          <Field label="Allowed contract addresses" hint="Optional; one per line">
            <Textarea name="contracts" className="font-mono text-xs" />
          </Field>
        </Section>

        <Section
          icon={CalendarClock}
          title="Approval and expiry"
          description="Manual approval keeps the final broadcast a deliberate user action."
        >
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] p-3.5">
            <div>
              <p className="text-sm font-medium">Require manual approval</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Show the simulation and checks before KeeperHub broadcasts.
              </p>
            </div>
            <Switch checked={manualApproval} onCheckedChange={setManualApproval} />
          </div>
          <Field label="Expiry date" hint="Optional, interpreted as end of UTC day">
            <Input name="expiresAt" type="date" />
          </Field>
        </Section>

        {error && (
          <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2.5 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <div className="mt-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Activating…" : "Activate mandate"}
            {!mutation.isPending && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </form>
    </>
  );
}
