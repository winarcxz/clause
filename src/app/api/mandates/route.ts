import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { ClauseRepository } from "@/lib/repositories/clause";
import { mandateInputSchema } from "@/lib/schemas/mandate";

export async function GET(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    const mandates = await new ClauseRepository().listMandates(user.id);
    return apiSuccess(mandates, correlationId);
  } catch (error) {
    return apiError(error, correlationId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const user = await requireAppUser();
    const input = mandateInputSchema.parse(await request.json());
    const mandate = await new ClauseRepository().createMandate(user.id, input);
    return apiSuccess(mandate, correlationId);
  } catch (error) {
    return apiError(error, correlationId);
  }
}
