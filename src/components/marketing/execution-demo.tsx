"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, LockKeyhole, Sparkles } from "lucide-react";

const timeline = [
  ["Mandate validated", "11 rules passed"],
  ["Simulation complete", "65,000 gas units"],
  ["Approval required", "Waiting for you"],
];

export function ExecutionDemo() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(10px)" }}
      animate={{ opacity: 1, transform: "translateY(0)" }}
      transition={{ duration: reduceMotion ? 0.12 : 0.35, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="relative"
    >
      <div className="absolute -inset-5 rounded-[28px] border border-[var(--border)] opacity-50" />
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="flex h-11 items-center justify-between border-b border-[var(--border)] px-4">
          <span className="flex items-center gap-2 text-xs font-semibold"><Sparkles className="size-3.5 text-[var(--accent)]" /> Agent session</span>
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><span className="size-1.5 rounded-full bg-[var(--success)]" /> Sepolia</span>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="ml-auto max-w-[82%] rounded-xl rounded-br-sm bg-[var(--foreground)] px-4 py-3 text-sm leading-6 text-[var(--background)]">
            Send 1 USDC to our design contractor.
          </div>
          <div className="max-w-[92%]">
            <p className="text-sm leading-6 text-[var(--muted)]">
              I prepared the transfer. Clause will verify it against your Operations mandate before anything moves.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-3">
                <span className="flex items-center gap-2 text-xs font-semibold"><LockKeyhole className="size-3.5 text-[var(--accent)]" /> Execution preview</span>
                <span className="text-[11px] text-[var(--muted)]">1 USDC</span>
              </div>
              <div className="divide-y divide-[var(--border)] px-3.5">
                {timeline.map(([title, detail], index) => (
                  <motion.div
                    key={title}
                    initial={{
                      opacity: 0,
                      transform: reduceMotion ? "none" : "translateY(4px)",
                    }}
                    animate={{ opacity: 1, transform: "translateY(0)" }}
                    transition={{
                      duration: reduceMotion ? 0.12 : 0.2,
                      delay: reduceMotion ? 0 : 0.18 + index * 0.06,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="flex items-center gap-2 text-xs"><Check className="size-3.5 text-[var(--success)]" /> {title}</span>
                    <span className="text-[11px] text-[var(--muted)]">{detail}</span>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-3">
                <button className="text-xs font-medium text-[var(--muted)]">Cancel</button>
                <button className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-3 py-1.5 text-xs font-semibold text-[var(--background)]">
                  Review <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
