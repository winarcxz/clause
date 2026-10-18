import { ZodError } from "zod";

import { AuthenticationError } from "@/lib/auth";
import { ProviderError } from "@/lib/providers/provider-error";
import { ApplicationError } from "@/lib/use-cases/application-error";

export function apiSuccess<T>(data: T, correlationId: string): Response {
  return Response.json({ ok: true, data, correlationId });
}

export function apiError(error: unknown, correlationId: string): Response {
  if (error instanceof AuthenticationError) {
    return Response.json(
      {
        ok: false,
        error: { code: error.code, message: error.message, retryable: false },
        correlationId,
      },
      { status: 401 },
    );
  }

  if (error instanceof ApplicationError) {
    return Response.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
        correlationId,
      },
      { status: error.status },
    );
  }

  if (error instanceof ProviderError) {
    return Response.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
        correlationId,
      },
      { status: error.retryable ? 503 : 422 },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "The request did not match the expected schema",
          retryable: false,
        },
        correlationId,
      },
      { status: 400 },
    );
  }

  return Response.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Clause could not complete the request",
        retryable: true,
      },
      correlationId,
    },
    { status: 500 },
  );
}

export function requestCorrelationId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && supplied.length <= 128 ? supplied : crypto.randomUUID();
}
