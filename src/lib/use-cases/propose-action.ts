import type { ClauseRepository } from "@/lib/repositories/clause";
import type {
  IntentGenerator,
  SupportedChainSummary,
} from "@/lib/providers/groq";
import { ApplicationError } from "@/lib/use-cases/application-error";

export interface ProposeActionDependencies {
  repository: Pick<
    ClauseRepository,
    "prepareConversation" | "recordIntent"
  >;
  generateIntent: IntentGenerator;
  listSupportedChains: () => Promise<SupportedChainSummary[]>;
}

export async function proposeAction(
  dependencies: ProposeActionDependencies,
  input: { userId: string; chatId?: string; message: string },
) {
  const conversation = await dependencies.repository.prepareConversation(
    input.userId,
    input.chatId,
    input.message,
  );
  if (conversation.aiPaused) {
    throw new ApplicationError(
      "AI_PAUSED",
      "AI proposals are paused in settings",
      { status: 423 },
    );
  }

  const chains = await dependencies.listSupportedChains();
  const generated = await dependencies.generateIntent({
    message: input.message,
    history: conversation.history,
    mandateSummary: conversation.mandate
      ? JSON.stringify(conversation.mandate)
      : "No active mandate. Explain that an active mandate is required before simulation.",
    supportedChains: chains,
  });
  const stored = await dependencies.repository.recordIntent({
    userId: input.userId,
    chatId: conversation.chatId,
    userMessage: input.message,
    generated,
    mandateId: conversation.mandate?.id ?? null,
  });

  return {
    chatId: conversation.chatId,
    message: stored.assistantMessage,
    proposal: stored.proposal,
  };
}
