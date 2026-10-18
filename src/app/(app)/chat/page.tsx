"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  MessageSquarePlus,
  PanelLeft,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import {
  ProposalCard,
  type ProposalView,
} from "@/components/execution/proposal-card";
import { PageSkeleton, QueryError } from "@/components/product/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-api";
import type { ChatRecord } from "@/lib/product-types";
import { cn } from "@/lib/utils";

interface ChatResponse {
  chatId: string;
  message: { id: string; content: string };
  proposal: ProposalView;
}

const suggestions = [
  "Send 2 USDC to an approved recipient on Sepolia",
  "Explain what my active mandate allows",
  "Prepare a 0.001 ETH test payment",
];

export default function ChatPage() {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [draft, setDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [proposalAction, setProposalAction] = useState<{
    id: string;
    action: "simulate" | "approve" | "cancel";
  } | null>(null);

  const chatsQuery = useQuery({
    queryKey: ["chats"],
    queryFn: () => apiFetch<ChatRecord[]>("/api/chats"),
  });

  const selected = useMemo(
    () =>
      creatingNew
        ? null
        : chatsQuery.data?.find((chat) => chat.id === chatId) ??
          chatsQuery.data?.[0] ??
          null,
    [chatId, chatsQuery.data, creatingNew],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected?.messages.length]);

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      apiFetch<ChatResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          ...(selected?.id && !creatingNew ? { chatId: selected.id } : {}),
          message,
        }),
      }),
    onSuccess: async (result) => {
      setChatId(result.chatId);
      setCreatingNew(false);
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const proposalMutation = useMutation({
    mutationFn: ({
      proposal,
      action,
    }: {
      proposal: ProposalView;
      action: "simulate" | "approve" | "cancel";
    }) =>
      apiFetch<unknown>(`/api/proposals/${proposal.id}/${action}`, {
        method: "POST",
      }),
    onMutate: ({ proposal, action }) =>
      setProposalAction({ id: proposal.id, action }),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.action === "simulate"
          ? "Simulation verified"
          : variables.action === "approve"
            ? "Execution submitted to KeeperHub"
            : "Proposal cancelled",
      );
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setProposalAction(null),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (message && !sendMutation.isPending) sendMutation.mutate(message);
  }

  if (chatsQuery.isLoading) return <PageSkeleton />;
  if (chatsQuery.isError) {
    return (
      <QueryError
        message={chatsQuery.error.message}
        retry={() => void chatsQuery.refetch()}
      />
    );
  }
  if (!chatsQuery.data) return <PageSkeleton />;

  const proposalsByMessage = new Map(
    (selected?.proposals ?? [])
      .filter((proposal) => proposal.assistantMessageId)
      .map((proposal) => [proposal.assistantMessageId, proposal]),
  );

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-3.5rem)] overflow-hidden sm:-mx-6 lg:-mx-10 lg:-my-9 lg:h-screen">
      <aside
        className={cn(
          "motion-translate absolute inset-y-0 left-0 z-20 w-64 border-r border-[var(--border)] bg-[var(--background)] p-3 transition-transform duration-200 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={() => {
            setChatId(null);
            setCreatingNew(true);
            setSidebarOpen(false);
          }}
        >
          <MessageSquarePlus className="size-4" />
          New conversation
        </Button>
        <p className="mb-2 mt-6 px-2 text-[10px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
          Recent sessions
        </p>
        <div className="space-y-1">
          {chatsQuery.data.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                setChatId(chat.id);
                setCreatingNew(false);
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full truncate rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                selected?.id === chat.id
                  ? "bg-[var(--surface-strong)] font-medium"
                  : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
              )}
            >
              {chat.title}
            </button>
          ))}
        </div>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="Close conversations"
          className="absolute inset-0 z-10 bg-black/15 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <section className="relative flex min-w-0 flex-1 flex-col bg-[var(--surface)]">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="lg:hidden"
              aria-label="Open conversations"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft className="size-4" />
            </Button>
            <div>
              <p className="text-sm font-semibold">{selected?.title ?? "New conversation"}</p>
              <p className="text-[11px] text-[var(--muted)]">Groq intent · KeeperHub execution</p>
            </div>
          </div>
          <Badge tone="success">
            <span className="mr-1.5 size-1.5 rounded-full bg-current" />
            Policy enforced
          </Badge>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!selected || selected.messages.length === 0 ? (
            <div className="grid h-full place-items-center px-5 py-12">
              <div className="w-full max-w-xl text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-[var(--foreground)] text-[var(--background)]">
                  <Bot className="size-5" />
                </span>
                <h1 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">
                  What should the agent prepare?
                </h1>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                  Clause can reason about an action, but only your active mandate and a KeeperHub simulation can make it executable.
                </p>
                <div className="mt-7 grid gap-2 text-left sm:grid-cols-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setDraft(suggestion)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--muted)] transition-[border-color,background-color] hover:border-[var(--border-strong)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
              <AnimatePresence initial={false}>
                {selected.messages.map((message) => {
                  const proposal = proposalsByMessage.get(message.id);
                  const assistant = message.role === "ASSISTANT";
                  return (
                    <motion.div
                      key={message.id}
                      initial={{
                        opacity: 0,
                        transform: reduceMotion ? "none" : "translateY(6px)",
                      }}
                      animate={{ opacity: 1, transform: "translateY(0)" }}
                      transition={{
                        duration: reduceMotion ? 0.12 : 0.16,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                      className="mb-7 flex gap-3"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                          assistant
                            ? "bg-[var(--foreground)] text-[var(--background)]"
                            : "bg-[var(--surface-subtle)] text-[var(--muted)]",
                        )}
                      >
                        {assistant ? <Sparkles className="size-3.5" /> : <UserRound className="size-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-xs font-semibold">
                          {assistant ? "Clause agent" : "You"}
                        </p>
                        <div className="prose-clause text-sm leading-7 text-[var(--foreground)]">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        {proposal && (
                          <ProposalCard
                            proposal={proposal}
                            pendingAction={
                              proposalAction?.id === proposal.id
                                ? proposalAction.action
                                : null
                            }
                            onSimulate={() =>
                              proposalMutation.mutate({ proposal, action: "simulate" })
                            }
                            onApprove={() =>
                              proposalMutation.mutate({ proposal, action: "approve" })
                            }
                            onCancel={() =>
                              proposalMutation.mutate({ proposal, action: "cancel" })
                            }
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {sendMutation.isPending && (
                <div className="flex gap-3">
                  <span className="grid size-7 place-items-center rounded-lg bg-[var(--foreground)] text-[var(--background)]">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="pt-1">
                    <p className="text-xs font-semibold">Clause agent</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span className="size-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                      Structuring intent and checking available testnets…
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-3 sm:px-6 sm:py-4">
          <form
            onSubmit={submit}
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-[var(--shadow-sm)] focus-within:ring-3 focus-within:ring-[var(--ring-soft)]"
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={4000}
              aria-label="Message the agent"
              placeholder="Describe an onchain action…"
              className="max-h-36 min-h-10 resize-none border-0 px-2 py-2 shadow-none focus:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={!draft.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-[var(--muted)]">
            The agent proposes. Clause validates. KeeperHub alone executes.
          </p>
        </div>
      </section>
    </div>
  );
}
