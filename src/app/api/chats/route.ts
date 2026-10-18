import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { ClauseRepository } from "@/lib/repositories/clause";

export async function GET(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    return apiSuccess(
      await new ClauseRepository().listChats(user.id),
      correlationId,
    );
  } catch (error) {
    return apiError(error, correlationId);
  }
}
