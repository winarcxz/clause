import { apiError, apiSuccess, requestCorrelationId } from "@/lib/api";
import { requireAppUser } from "@/lib/auth";
import { checkKeeperHubMcp } from "@/lib/providers/keeperhub-mcp";

export async function GET(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    await requireAppUser();
    const keeperHubConfigured = Boolean(process.env.KEEPERHUB_API_KEY);
    const groqConfigured = Boolean(process.env.GROQ_API_KEY);
    const databaseConfigured = Boolean(process.env.DATABASE_URL);

    let keeperHubMcp: Awaited<ReturnType<typeof checkKeeperHubMcp>> | null =
      null;
    if (keeperHubConfigured) {
      try {
        keeperHubMcp = await checkKeeperHubMcp();
      } catch {
        keeperHubMcp = {
          healthy: false,
          discoveryTools: [],
          blockedExecutionTools: [],
        };
      }
    }

    return apiSuccess(
      {
        groq: { configured: groqConfigured },
        database: { configured: databaseConfigured },
        keeperHub: {
          configured: keeperHubConfigured,
          mcp: keeperHubMcp,
        },
      },
      correlationId,
    );
  } catch (error) {
    return apiError(error, correlationId);
  }
}
