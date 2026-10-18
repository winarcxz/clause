import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { ProviderError } from "@/lib/providers/provider-error";

export interface McpToolSummary {
  name: string;
  description?: string;
}

export interface KeeperHubMcpAssessment {
  healthy: boolean;
  discoveryTools: string[];
  blockedExecutionTools: string[];
}

const readOnlyDiscoveryTools = new Set([
  "list_action_schemas",
  "tools_documentation",
]);

export function assessKeeperHubMcpTools(
  tools: McpToolSummary[],
): KeeperHubMcpAssessment {
  const names = tools.map((tool) => tool.name);
  const discoveryTools = names.filter((name) =>
    readOnlyDiscoveryTools.has(name),
  );
  const blockedExecutionTools = names.filter(
    (name) => name.startsWith("execute_") || name.includes("contract_call"),
  );

  return {
    healthy: discoveryTools.length > 0,
    discoveryTools,
    blockedExecutionTools,
  };
}

export async function checkKeeperHubMcp(options?: {
  apiKey?: string;
  url?: string;
}): Promise<KeeperHubMcpAssessment> {
  const apiKey = options?.apiKey ?? process.env.KEEPERHUB_API_KEY;
  if (!apiKey) {
    throw new Error("KEEPERHUB_API_KEY is required");
  }

  const client = new Client(
    { name: "clause-capability-check", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(
    new URL(options?.url ?? process.env.KEEPERHUB_MCP_URL ?? "https://app.keeperhub.com/mcp"),
    {
      requestInit: {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    },
  );

  try {
    await client.connect(transport);
    const response = await client.listTools();
    return assessKeeperHubMcpTools(response.tools);
  } catch (cause) {
    throw new ProviderError({
      code: "KEEPERHUB_MCP_UNAVAILABLE",
      message: "KeeperHub MCP capability discovery failed",
      retryable: true,
      cause,
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}
