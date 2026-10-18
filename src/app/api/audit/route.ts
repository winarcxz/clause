import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { ClauseRepository } from "@/lib/repositories/clause";

export async function GET(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    const take = Number(new URL(request.url).searchParams.get("take") ?? 80);
    return apiSuccess(
      await new ClauseRepository().listAudit(
        user.id,
        Number.isFinite(take) ? take : 80,
      ),
      correlationId,
    );
  } catch (error) {
    return apiError(error, correlationId);
  }
}
