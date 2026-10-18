"use client";

import { UserButton } from "@clerk/nextjs";
import {
  Bot,
  FileClock,
  Gauge,
  Menu,
  PlusCircle,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/chat", label: "Agent", icon: Bot },
  { href: "/mandates/new", label: "New mandate", icon: PlusCircle },
  { href: "/audit", label: "Audit", icon: FileClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold tracking-[-0.025em]">
      <span className="grid size-7 place-items-center rounded-lg bg-[var(--foreground)] text-[var(--background)]">
        <ShieldCheck className="size-4" strokeWidth={2.25} />
      </span>
      Clause
    </span>
  );
}

export function AppShell({
  children,
  authConfigured,
}: {
  children: ReactNode;
  authConfigured: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_86%,transparent)] px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" aria-label="Clause dashboard">
          <BrandMark />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </header>

      <aside
        className={cn(
          "motion-translate fixed inset-x-3 top-16 z-30 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-lg)] transition-[opacity,transform] duration-200 ease-[var(--ease-out)] lg:inset-y-0 lg:left-0 lg:right-auto lg:top-0 lg:flex lg:w-60 lg:translate-y-0 lg:flex-col lg:rounded-none lg:border-y-0 lg:border-l-0 lg:p-4 lg:opacity-100 lg:shadow-none",
          mobileOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0 lg:pointer-events-auto",
        )}
      >
        <Link
          href="/dashboard"
          className="hidden h-11 items-center px-2 lg:flex"
          aria-label="Clause dashboard"
        >
          <BrandMark />
        </Link>
        <nav aria-label="Product" className="mt-1 space-y-1 lg:mt-6">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-[background-color,color] duration-150",
                  active
                    ? "bg-[var(--surface-strong)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon className="size-4" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 border-t border-[var(--border)] pt-3 lg:mt-auto">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            {authConfigured ? (
              <UserButton />
            ) : (
              <span className="grid size-7 place-items-center rounded-full bg-[var(--warning-soft)] text-xs font-semibold text-[var(--warning)]">
                !
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {authConfigured ? "Account" : "Setup required"}
              </p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                Shared KeeperHub testnet
              </p>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="fixed inset-0 z-20 bg-black/15 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="px-4 py-6 sm:px-6 lg:ml-60 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
