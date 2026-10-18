import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/lib/db";

interface AuthState {
  userId: string | null;
}

export class AuthenticationError extends Error {
  readonly code = "UNAUTHENTICATED";

  constructor() {
    super("Authentication is required");
    this.name = "AuthenticationError";
  }
}

export function getAuthenticatedUserId(state: AuthState): string {
  if (!state.userId) {
    throw new AuthenticationError();
  }

  return state.userId;
}

export async function requireAppUser() {
  const clerkAuth = await auth();
  const clerkId = getAuthenticatedUserId({ userId: clerkAuth.userId });

  return getDb().user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      settings: { create: {} },
    },
    update: { deletedAt: null },
  });
}
