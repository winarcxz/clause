import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { getDb } from "@/lib/db";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const event = await verifyWebhook(request);
    const clerkId = event.data.id;

    if (
      typeof clerkId === "string" &&
      (event.type === "user.created" || event.type === "user.updated")
    ) {
      await getDb().user.upsert({
        where: { clerkId },
        create: {
          clerkId,
          settings: { create: {} },
        },
        update: { deletedAt: null },
      });
    }

    if (typeof clerkId === "string" && event.type === "user.deleted") {
      await getDb().user.updateMany({
        where: { clerkId },
        data: { deletedAt: new Date() },
      });
    }

    return Response.json({ received: true });
  } catch {
    return Response.json(
      { received: false, error: "Invalid webhook signature" },
      { status: 400 },
    );
  }
}
