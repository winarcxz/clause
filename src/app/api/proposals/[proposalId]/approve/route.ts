import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { createDefaultKeeperHubClient } from "@/lib/providers/keeperhub";
import { ClauseRepository } from "@/lib/repositories/clause";
import { approveProposal } from "@/lib/use-cases/approve-proposal";

interface RouteContext {
  params: Promise<{ proposalId: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    const { proposalId } = await context.params;
    const result = await approveProposal(
      {
        repository: new ClauseRepository(),
        keeperHub: createDefaultKeeperHubClient(),
      },
      { userId: user.id, proposalId },
    );
    return apiSuccess(result, correlationId);
  } catch (error) {
    return apiError(error, correlationId);
  }
}
