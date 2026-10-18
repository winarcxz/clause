import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  clausePrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access persistent data");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export function getDb(): PrismaClient {
  const client = globalForPrisma.clausePrisma ?? createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.clausePrisma = client;
  }

  return client;
}
