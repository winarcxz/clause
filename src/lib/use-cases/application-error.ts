export class ApplicationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ApplicationError";
    this.code = code;
    this.status = options?.status ?? 400;
    this.retryable = options?.retryable ?? false;
  }
}
