import {
  assessKeeperHubMcpTools,
  type McpToolSummary,
} from "@/lib/providers/keeperhub-mcp";

describe("assessKeeperHubMcpTools", () => {
  it("reports discovery tools without granting execution authority", () => {
    const tools: McpToolSummary[] = [
      { name: "list_action_schemas", description: "List supported actions" },
      { name: "tools_documentation", description: "Read tool documentation" },
      { name: "execute_transfer", description: "Transfer tokens" },
    ];

    expect(assessKeeperHubMcpTools(tools)).toEqual({
      healthy: true,
      discoveryTools: ["list_action_schemas", "tools_documentation"],
      blockedExecutionTools: ["execute_transfer"],
    });
  });

  it("fails health when no read-only discovery tool is available", () => {
    expect(
      assessKeeperHubMcpTools([
        { name: "execute_contract_call", description: "Execute a call" },
      ]),
    ).toMatchObject({
      healthy: false,
      discoveryTools: [],
    });
  });
});
