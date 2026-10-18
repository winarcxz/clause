import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronRight,
  Code2,
  FileSearch,
  KeyRound,
  ScanSearch,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/app-shell";
import { ExecutionDemo } from "@/components/marketing/execution-demo";
import { PageReveal } from "@/components/page-reveal";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Braces,
    title: "Intent, not authority",
    description:
      "The model proposes schema-valid actions. It never receives a signing key or execution tool.",
  },
  {
    icon: ScanSearch,
    title: "Policy before gas",
    description:
      "Every amount, chain, token, recipient, contract, and spend limit is checked deterministically.",
  },
  {
    icon: FileSearch,
    title: "Proof after execution",
    description:
      "Simulation inputs, approvals, KeeperHub IDs, gas, and transaction hashes remain inspectable.",
  },
];

const steps = [
  ["01", "Describe the outcome", "Ask the agent to pay, transfer, or call an approved contract."],
  ["02", "Inspect the proof", "Review mandate checks and KeeperHub's dry-run before signing off."],
  ["03", "Approve one execution", "Clause sends the exact simulated payload through KeeperHub once."],
];

export default function HomePage() {
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com";

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--background)]">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Clause home">
          <BrandMark />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
          <a href="#features" className="hover:text-[var(--foreground)]">Safety</a>
          <a href="#how-it-works" className="hover:text-[var(--foreground)]">How it works</a>
          <a href="https://docs.keeperhub.com" target="_blank" rel="noreferrer" className="hover:text-[var(--foreground)]">
            KeeperHub
          </a>
        </nav>
        <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
          Open app <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-24 pt-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:pb-32 lg:pt-28">
          <PageReveal>
            <Badge className="mb-6 border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]">
              <span className="mr-1.5 size-1.5 rounded-full bg-[var(--accent)]" />
              KeeperHub-native execution
            </Badge>
            <h1 className="max-w-4xl text-balance text-[clamp(3rem,7vw,5.9rem)] font-semibold leading-[0.96] tracking-[-0.065em]">
              The safest way to let AI spend money.
            </h1>
            <p className="mt-7 max-w-xl text-balance text-lg leading-8 text-[var(--muted)]">
              Create spending rules for AI agents. Let them reason freely.
              Execute only what your mandate permits.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
                Get started <ChevronRight className="size-4" />
              </Link>
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "lg", variant: "secondary" })}
              >
                <Code2 className="size-4" /> GitHub
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-[var(--muted)]">
              {["Stable testnets", "Explicit approval", "Idempotent execution"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-[var(--success)]" /> {item}
                </span>
              ))}
            </div>
          </PageReveal>
          <ExecutionDemo />
        </section>

        <section id="features" className="border-y border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto grid max-w-7xl sm:grid-cols-3">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className={`px-7 py-10 sm:px-8 sm:py-14 ${index > 0 ? "border-t border-[var(--border)] sm:border-l sm:border-t-0" : ""}`}
              >
                <feature.icon className="size-5 text-[var(--accent)]" strokeWidth={1.8} />
                <h2 className="mt-7 text-base font-semibold tracking-[-0.02em]">{feature.title}</h2>
                <p className="mt-2.5 max-w-sm text-sm leading-6 text-[var(--muted)]">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">From prompt to proof</p>
              <h2 className="mt-4 max-w-md text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-5xl">
                Freedom to reason. Boundaries to act.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[var(--muted)]">
                Clause separates what an agent can think from what it can move onchain.
              </p>
            </div>
            <div className="border-t border-[var(--border)]">
              {steps.map(([number, title, description]) => (
                <div key={number} className="grid gap-3 border-b border-[var(--border)] py-7 sm:grid-cols-[56px_180px_1fr] sm:gap-6">
                  <span className="font-mono text-xs text-[var(--muted-soft)]">{number}</span>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--foreground)] px-7 py-12 text-[var(--background)] sm:px-12 sm:py-16">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex gap-3">
                  <span className="grid size-9 place-items-center rounded-lg border border-white/15"><Bot className="size-4" /></span>
                  <span className="grid size-9 place-items-center rounded-lg border border-white/15"><KeyRound className="size-4" /></span>
                  <span className="grid size-9 place-items-center rounded-lg border border-white/15"><WalletCards className="size-4" /></span>
                </div>
                <h2 className="mt-8 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                  Give your agent a mandate, not your wallet.
                </h2>
              </div>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-[var(--background)] text-[var(--foreground)] hover:bg-white",
                )}
              >
                Start on testnet <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <p>Permissioned onchain execution through KeeperHub.</p>
          <div className="flex gap-5">
            <a href={githubUrl}>GitHub</a>
            <a href="https://docs.keeperhub.com">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
