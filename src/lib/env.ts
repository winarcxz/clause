import { z } from "zod";

const providerEnvSchema = z.object({
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
  KEEPERHUB_API_KEY: z.string().startsWith("kh_"),
  KEEPERHUB_BASE_URL: z
    .url()
    .default("https://app.keeperhub.com/api"),
  KEEPERHUB_MCP_URL: z.url().default("https://app.keeperhub.com/mcp"),
});

export type ProviderEnv = z.infer<typeof providerEnvSchema>;

export function parseProviderEnv(environment: NodeJS.ProcessEnv): ProviderEnv {
  const result = providerEnvSchema.safeParse(environment);
  if (!result.success) {
    const keys = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(`Missing or invalid provider environment: ${keys}`);
  }

  return result.data;
}
