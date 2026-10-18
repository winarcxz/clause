import { supportedActionSchema } from "@/lib/domain/action";
import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { createDefaultKeeperHubClient } from "@/lib/providers/keeperhub";
import { ClauseRepository } from "@/lib/repositories/clause";
import { ApplicationError } from "@/lib/use-cases/application-error";

interface RouteContext {
  params: Promise<{ executionId: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    const { executionId } = await context.params;
    const repository = new ClauseRepository();
    let execution = await repository.getExecutionForUser(user.id, executionId);
    if (!execution) {
      throw new ApplicationError("EXECUTION_NOT_FOUND", "Execution not found", {
        status: 404,
      });
    }

    if (
      (execution.status === "PENDING" ||
        execution.status === "RUNNING" ||
        execution.status === "UNKNOWN") &&
      execution.keeperHubExecutionId
    ) {
      const action = supportedActionSchema.safeParse(
        execution.proposal.actionJson,
      );
      if (action.success) {
        const status = await createDefaultKeeperHubClient().getExecutionStatus(
          execution.keeperHubExecutionId,
        );
        await repository.recordExecutionStatus(
          {
            proposalId: execution.proposalId,
            action: action.data,
            idempotencyKey: execution.idempotencyKey,
          },
          status,
        );
        execution = await repository.getExecutionForUser(user.id, executionId);
      }
    }

    return apiSuccess(execution, correlationId);
  } catch (error) {
    return apiError(error, correlationId);
  }
}
