import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { ClauseRepository } from "@/lib/repositories/clause";
import { ApplicationError } from "@/lib/use-cases/application-error";

interface RouteContext {
  params: Promise<{ proposalId: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    const { proposalId } = await context.params;
    const proposal = await new ClauseRepository().getProposalForUser(
      user.id,
      proposalId,
    );
    if (!proposal) {
      throw new ApplicationError("PROPOSAL_NOT_FOUND", "Proposal not found", {
        status: 404,
      });
    }
    return apiSuccess(proposal, correlationId);
  } catch (error) {
    return apiError(error, correlationId);
  }
}
