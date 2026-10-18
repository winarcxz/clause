import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { ClauseRepository } from "@/lib/repositories/clause";
import { ApplicationError } from "@/lib/use-cases/application-error";

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
    const cancelled = await new ClauseRepository().cancelProposal(
      user.id,
      proposalId,
    );
    if (!cancelled) {
      throw new ApplicationError(
        "PROPOSAL_NOT_CANCELLABLE",
        "The proposal is already executing or terminal",
        { status: 409 },
      );
    }
    return apiSuccess({ status: "CANCELLED" }, correlationId);
  } catch (error) {
    return apiError(error, correlationId);
  }
}
